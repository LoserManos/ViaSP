import pytest

from app.api.dependencias import get_servico_consulta
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel


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


def test_listar_paradas_da_linha_retorna_todas_e_enriquece_gtfs(client):
    from unittest.mock import AsyncMock
    from app.dominio import Parada

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

