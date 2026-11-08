from datetime import datetime
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import pytest

from app.api.dependencias import get_servico_consulta
from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada, PrevisaoChegada, Veiculo
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.servicos.cliente_sptrans import ClienteSPTrans
from app.servicos.servico_consulta import ServicoConsulta


def test_saude(client):
    resposta = client.get("/api/saude")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_totem_usa_dados_do_gtfs(client):
    corpo = client.get("/api/totem").json()
    assert corpo["identificador"] == "totem-teste"
    assert corpo["parada"] == {
        "codigo": 440016921,
        "nome": "Av. Paulista, 2027",
        "endereco": "R Padre Joao Manuel/ R Augusta -- Conjunto Nacional",
        "latitude": -23.558947,
        "longitude": -46.659585,
    }


def test_totem_sobe_com_parada_fora_do_gtfs_e_sem_sptrans(criar_client):
    client = criar_client(PARADA_CODIGO="123")
    assert client.get("/api/totem").json()["parada"]["nome"] == "Parada 123"


def test_totem_sobe_sem_gtfs(criar_client, tmp_path):
    client = criar_client(GTFS_CAMINHO=str(tmp_path / "nao-existe"))
    assert client.get("/api/totem").json()["parada"]["codigo"] == 440016921


class _ServicoQueFalha:
    def __init__(self, excecao: Exception) -> None:
        self._excecao = excecao

    async def buscar_linhas(self, parada, termo=""):
        raise self._excecao


@pytest.mark.parametrize(
    ("excecao", "status", "codigo"),
    [
        (ErroAutenticacaoSPTrans("token inválido"), 502, "erro_autenticacao"),
        (SPTransIndisponivel("timeout"), 503, "sptrans_indisponivel"),
        (ErroSPTrans("resposta inesperada"), 502, "erro_sptrans"),
    ],
)
def test_erros_da_sptrans_seguem_formato_padrao(client, excecao, status, codigo):
    client.app.dependency_overrides[get_servico_consulta] = lambda: _ServicoQueFalha(excecao)

    resposta = client.get("/api/linhas")

    corpo = resposta.json()
    assert resposta.status_code == status
    assert set(corpo) == {"codigo", "mensagem", "tentar_novamente"}
    assert corpo["codigo"] == codigo
    assert corpo["tentar_novamente"] is True
    # A mensagem é para o passageiro: não vaza o detalhe técnico da exceção
    assert corpo["mensagem"] and str(excecao) not in corpo["mensagem"]


def test_parametro_invalido_retorna_422_no_formato_padrao(client):
    resposta = client.get("/api/previsoes", params={"codigo_linha": "abc"})

    assert resposta.status_code == 422
    assert resposta.json() == {
        "codigo": "requisicao_invalida",
        "mensagem": "Parâmetros da requisição inválidos.",
        "tentar_novamente": False,
    }


def test_parametro_obrigatorio_ausente_retorna_422(client):
    resposta = client.get("/api/previsoes")

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "requisicao_invalida"


def test_ttls_do_cache_sao_configuraveis_por_variavel_de_ambiente(criar_client):
    client = criar_client(
        CACHE_TTL_LINHAS_SEGUNDOS="90",
        CACHE_TTL_PARADAS_SEGUNDOS="7200",
        CACHE_TTL_PREVISOES_SEGUNDOS="25",
    )
    servico: ServicoConsulta = client.app.state.servico_consulta

    assert servico._ttl_linhas_segundos == 90.0
    assert servico._ttl_paradas_segundos == 7200.0
    assert servico._ttl_previsoes_segundos == 25.0


def test_rotas_expoem_indicador_desatualizado_quando_sptrans_cai(client):
    agora = [1000.0]
    parada = Parada(codigo=440016921, nome="Av. Paulista, 2027")
    linha = Linha(codigo=2506, numero="8000-10", sentido=1, origem="LAPA", destino="CENTRO")

    mock_cliente = AsyncMock(spec=ClienteSPTrans)
    mock_cliente.buscar_linhas_com_previsao.side_effect = [
        [linha],
        SPTransIndisponivel("Queda na SPTrans"),
    ]
    mock_cliente.buscar_paradas.side_effect = [
        [Parada(codigo=614432, nome="BABY BARIONY C/B", endereco="R PEDRO MACHADO", latitude=-23.52, longitude=-46.67)],
        SPTransIndisponivel("Queda na SPTrans"),
    ]
    mock_cliente.obter_previsoes.side_effect = [
        ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime(2026, 11, 4, 16, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
            horario_referencia="16:00",
            estado=EstadoConsulta.SUCESSO,
            previsoes=[PrevisaoChegada(horario_previsto="16:05", veiculo=Veiculo(prefixo="81506"))],
        ),
        SPTransIndisponivel("Queda na SPTrans"),
    ]

    servico = ServicoConsulta(
        mock_cliente,
        relogio=lambda: agora[0],
        ttl_linhas_segundos=60.0,
        ttl_paradas_segundos=3600.0,
        ttl_previsoes_segundos=15.0,
    )
    client.app.dependency_overrides[get_servico_consulta] = lambda: servico

    # 1. Primeiras consultas: dados atualizados
    resp_linhas = client.get("/api/linhas")
    resp_paradas = client.get("/api/linhas/2506/paradas")
    resp_previsoes = client.get("/api/previsoes", params={"codigo_linha": 2506})

    assert resp_linhas.status_code == 200
    assert resp_linhas.headers["X-Dados-Desatualizados"] == "false"
    assert resp_paradas.status_code == 200
    assert resp_paradas.headers["X-Dados-Desatualizados"] == "false"
    assert resp_previsoes.status_code == 200
    assert resp_previsoes.headers["X-Dados-Desatualizados"] == "false"
    assert resp_previsoes.json()["desatualizado"] is False

    # 2. Avança o relógio além de todos os TTLs e simula queda da SPTrans
    agora[0] += 3601.0

    resp_linhas_queda = client.get("/api/linhas")
    resp_paradas_queda = client.get("/api/linhas/2506/paradas")
    resp_previsoes_queda = client.get("/api/previsoes", params={"codigo_linha": 2506})

    assert resp_linhas_queda.status_code == 200
    assert resp_linhas_queda.headers["X-Dados-Desatualizados"] == "true"
    assert resp_linhas_queda.json()[0]["codigo"] == 2506

    assert resp_paradas_queda.status_code == 200
    assert resp_paradas_queda.headers["X-Dados-Desatualizados"] == "true"
    assert resp_paradas_queda.json()[0]["codigo"] == 614432

    corpo_previsoes = resp_previsoes_queda.json()
    assert resp_previsoes_queda.status_code == 200
    assert resp_previsoes_queda.headers["X-Dados-Desatualizados"] == "true"
    assert corpo_previsoes["desatualizado"] is True
    assert corpo_previsoes["estado"] == "sucesso"
    assert corpo_previsoes["previsoes"] == [{"horario_previsto": "16:05", "veiculo": {"prefixo": "81506"}}]
    assert "indisponível" in corpo_previsoes["mensagem_erro"]


def test_listar_paradas_da_linha_retorna_todas_e_enriquece_gtfs(client):
    mock_servico = AsyncMock()
    # 7 paradas, sendo uma sem nome para testar enriquecimento via GTFS
    mock_servico.consultar_paradas.return_value = [
        Parada(codigo=1, nome="Parada 1", endereco="Rua 1", latitude=0.0, longitude=0.0),
        Parada(codigo=2, nome="Parada 2", endereco="Rua 2", latitude=0.0, longitude=0.0),
        Parada(codigo=3, nome="Parada 3", endereco="Rua 3", latitude=0.0, longitude=0.0),
        Parada(codigo=4, nome="Parada 4", endereco="Rua 4", latitude=0.0, longitude=0.0),
        Parada(codigo=5, nome="Parada 5", endereco="Rua 5", latitude=0.0, longitude=0.0),
        Parada(codigo=6, nome="Parada 6", endereco="Rua 6", latitude=0.0, longitude=0.0),
        Parada(codigo=440016921, nome="", endereco="", latitude=0.0, longitude=0.0),
    ]

    client.app.dependency_overrides[get_servico_consulta] = lambda: mock_servico
    resposta = client.get("/api/linhas/307/paradas")

    assert resposta.status_code == 200
    dados = resposta.json()
    assert len(dados) == 7
    # Verifica enriquecimento com GTFS da parada sem nome (440016921)
    parada_gtfs = next(p for p in dados if p["codigo"] == 440016921)
    assert parada_gtfs["nome"] == "Av. Paulista, 2027"
