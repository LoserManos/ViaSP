import asyncio
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import pytest

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada, PrevisaoChegada, Veiculo
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.servicos.cliente_sptrans import ClienteSPTrans
from app.servicos.servico_consulta import ServicoConsulta

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class FakeClienteSPTrans:
    """Cliente falso para testes unitários do ServicoConsulta (ISS-08)."""
    def __init__(self, linhas_retorno: list[Linha]):
        self._linhas_retorno = linhas_retorno
        self.chamadas = 0

    async def buscar_linhas_com_previsao(self, codigo_parada: int) -> list[Linha]:
        self.chamadas += 1
        return self._linhas_retorno


def _criar_paradas(quantidade: int) -> list[Parada]:
    """Helper para gerar uma sequência sintética de paradas (ISS-10)."""
    return [
        Parada(
            codigo=i,
            nome=f"Parada {i}",
            endereco=f"Rua {i}",
            latitude=-23.50 + (i * 0.001),
            longitude=-46.60 + (i * 0.001),
        )
        for i in range(quantidade)
    ]


@pytest.fixture
def mock_cliente() -> AsyncMock:
    """Mock assíncrono do ClienteSPTrans (ISS-10)."""
    return AsyncMock(spec=ClienteSPTrans)


@pytest.fixture
def servico(mock_cliente: AsyncMock) -> ServicoConsulta:
    return ServicoConsulta(cliente=mock_cliente)


# ==========================================
# ISS-08: Buscar Linhas do Ponto
# ==========================================

@pytest.mark.asyncio
async def test_buscar_linhas_sem_termo_retorna_todas():
    linhas_falsas = [
        Linha(codigo=1, numero="8000", sentido=1, origem="LAPA", destino="CENTRO"),
        Linha(codigo=2, numero="9000", sentido=2, origem="CENTRO", destino="LAPA"),
    ]
    cliente_fake = FakeClienteSPTrans(linhas_falsas)
    servico = ServicoConsulta(cliente_fake)  # type: ignore
    parada = Parada(codigo=123)

    resultado = await servico.buscar_linhas(parada, termo="")

    assert len(resultado) == 2
    assert cliente_fake.chamadas == 1


@pytest.mark.asyncio
async def test_buscar_linhas_filtro_por_numero():
    linhas_falsas = [
        Linha(codigo=1, numero="8000", sentido=1, origem="LAPA", destino="CENTRO"),
        Linha(codigo=2, numero="9000", sentido=2, origem="CENTRO", destino="LAPA"),
    ]
    servico = ServicoConsulta(FakeClienteSPTrans(linhas_falsas))  # type: ignore
    parada = Parada(codigo=123)

    resultado = await servico.buscar_linhas(parada, termo="8000")

    assert len(resultado) == 1
    assert resultado[0].numero == "8000"


@pytest.mark.asyncio
async def test_buscar_linhas_filtro_ignora_acentos_e_maiusculas():
    linhas_falsas = [
        Linha(codigo=1, numero="8000", sentido=1, origem="Sé", destino="Praça da Sé"),
        Linha(codigo=2, numero="9000", sentido=2, origem="Paulista", destino="Centro"),
    ]
    servico = ServicoConsulta(FakeClienteSPTrans(linhas_falsas))  # type: ignore
    parada = Parada(codigo=123)

    resultado_maiusculo = await servico.buscar_linhas(parada, termo="PAULISTA")
    assert len(resultado_maiusculo) == 1
    assert resultado_maiusculo[0].numero == "9000"

    resultado_sem_acento = await servico.buscar_linhas(parada, termo="praca da se")
    assert len(resultado_sem_acento) == 1
    assert resultado_sem_acento[0].numero == "8000"


@pytest.mark.asyncio
async def test_buscar_linhas_termo_sem_resultado_retorna_lista_vazia():
    linhas_falsas = [
        Linha(codigo=1, numero="8000", sentido=1, origem="LAPA", destino="CENTRO"),
    ]
    servico = ServicoConsulta(FakeClienteSPTrans(linhas_falsas))  # type: ignore
    parada = Parada(codigo=123)

    resultado = await servico.buscar_linhas(parada, termo="Linha Inexistente")

    assert resultado == []


# ==========================================
# ISS-10: Consultar Paradas (Itinerário)
# ==========================================

@pytest.mark.asyncio
async def test_consultar_paradas_linha_sem_paradas(servico: ServicoConsulta, mock_cliente: AsyncMock):
    mock_cliente.buscar_paradas.return_value = []
    linha = Linha(codigo=1001, numero="8000-10", sentido=1)

    resultado = await servico.consultar_paradas(linha)

    mock_cliente.buscar_paradas.assert_awaited_once_with(1001)
    assert resultado == []


@pytest.mark.asyncio
@pytest.mark.parametrize("quantidade", [1, 2, 3, 4, 5])
async def test_consultar_paradas_linhas_curtas_retorna_todas(
    servico: ServicoConsulta, mock_cliente: AsyncMock, quantidade: int
):
    paradas_originais = _criar_paradas(quantidade)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=1002, numero="8000-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == quantidade
    assert resultado == paradas_originais


@pytest.mark.asyncio
async def test_consultar_paradas_linha_longa_amostragem_uniforme(servico: ServicoConsulta, mock_cliente: AsyncMock):
    paradas_originais = _criar_paradas(21)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=2001, numero="175P-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == 5
    assert resultado[0] == paradas_originais[0]
    assert resultado[-1] == paradas_originais[20]
    assert resultado[1] == paradas_originais[5]
    assert resultado[2] == paradas_originais[10]
    assert resultado[3] == paradas_originais[15]


@pytest.mark.asyncio
async def test_consultar_paradas_borda_logo_acima_do_limite(servico: ServicoConsulta, mock_cliente: AsyncMock):
    paradas_originais = _criar_paradas(6)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=2002, numero="175P-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == 5
    assert resultado[0] == paradas_originais[0]
    assert resultado[-1] == paradas_originais[5]
    codigos = [p.codigo for p in resultado]
    assert len(codigos) == len(set(codigos))


@pytest.mark.asyncio
async def test_consultar_paradas_limite_customizado(servico: ServicoConsulta, mock_cliente: AsyncMock):
    paradas_originais = _criar_paradas(11)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=2003, numero="175P-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=3)

    assert len(resultado) == 3
    assert resultado[0] == paradas_originais[0]
    assert resultado[1] == paradas_originais[5]
    assert resultado[2] == paradas_originais[10]


@pytest.mark.asyncio
async def test_consultar_paradas_com_fixture_real_sptrans(servico: ServicoConsulta, mock_cliente: AsyncMock):
    fixture_caminho = FIXTURES_DIR / "paradas_por_linha.json"
    dados_json = json.loads(fixture_caminho.read_text(encoding="utf-8"))

    paradas_reais = [
        Parada(
            codigo=item["cp"],
            nome=item.get("np", ""),
            endereco=item.get("ed", ""),
            latitude=item.get("py", 0.0),
            longitude=item.get("px", 0.0),
        )
        for item in dados_json
    ]
    mock_cliente.buscar_paradas.return_value = paradas_reais
    linha = Linha(codigo=1273, numero="875A-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(paradas_reais) == 13
    assert len(resultado) == 5

    assert resultado[0].nome == "BABY BARIONY C/B"
    assert resultado[0].codigo == 614432

    assert resultado[-1].nome == "NOTHMANN C/B"
    assert resultado[-1].codigo == 700016865

    codigos = [p.codigo for p in resultado]
    assert len(codigos) == len(set(codigos))


@pytest.mark.asyncio
async def test_buscar_linhas_usa_cache_dentro_do_ttl():
    agora = [1000.0]
    cliente_fake = FakeClienteSPTrans([Linha(codigo=1, numero="8000", sentido=1)])
    servico = ServicoConsulta(cliente_fake, relogio=lambda: agora[0])  # type: ignore
    parada = Parada(codigo=440016921)

    await servico.buscar_linhas(parada)
    await servico.buscar_linhas(parada, termo="8000")
    assert cliente_fake.chamadas == 1

    agora[0] += 61
    await servico.buscar_linhas(parada)
    assert cliente_fake.chamadas == 2


@pytest.mark.asyncio
async def test_buscar_linhas_simultaneas_fazem_uma_chamada():
    cliente_fake = FakeClienteSPTrans([Linha(codigo=1, numero="8000", sentido=1)])
    servico = ServicoConsulta(cliente_fake)  # type: ignore
    parada = Parada(codigo=440016921)

    await asyncio.gather(servico.buscar_linhas(parada), servico.buscar_linhas(parada))

    assert cliente_fake.chamadas == 1


# ==========================================
# ISS-11.1: Cache com TTL e Relógio Simulado
# ==========================================


@pytest.mark.asyncio
async def test_buscar_linhas_respeita_ttl_configuravel_com_relogio_simulado(mock_cliente: AsyncMock):
    agora = [500.0]
    mock_cliente.buscar_linhas_com_previsao.return_value = [
        Linha(codigo=1, numero="8000-10", sentido=1, origem="LAPA", destino="CENTRO")
    ]
    servico = ServicoConsulta(
        mock_cliente,
        relogio=lambda: agora[0],
        ttl_linhas_segundos=120.0,
    )
    parada = Parada(codigo=440016921)

    primeira = await servico.buscar_linhas(parada)
    agora[0] += 119.0
    segunda = await servico.buscar_linhas(parada)

    assert mock_cliente.buscar_linhas_com_previsao.await_count == 1
    assert primeira.desatualizado is False
    assert segunda.desatualizado is False

    agora[0] += 2.0  # 121s desde a primeira consulta
    await servico.buscar_linhas(parada)
    assert mock_cliente.buscar_linhas_com_previsao.await_count == 2


@pytest.mark.asyncio
async def test_consultar_paradas_usa_cache_com_ttl_longo_e_relogio_simulado(mock_cliente: AsyncMock):
    agora = [1000.0]
    mock_cliente.buscar_paradas.return_value = _criar_paradas(10)
    servico = ServicoConsulta(
        mock_cliente,
        relogio=lambda: agora[0],
        ttl_paradas_segundos=3600.0,
    )
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)

    primeira = await servico.consultar_paradas(linha)
    agora[0] += 3599.0
    segunda = await servico.consultar_paradas(linha)

    assert mock_cliente.buscar_paradas.await_count == 1
    assert primeira == segunda
    assert primeira.desatualizado is False
    assert segunda.desatualizado is False

    agora[0] += 2.0  # 3601s: expirou o TTL longo
    await servico.consultar_paradas(linha)
    assert mock_cliente.buscar_paradas.await_count == 2


@pytest.mark.asyncio
async def test_consultar_paradas_simultaneas_fazem_uma_chamada(mock_cliente: AsyncMock):
    async def buscar_lento(_codigo_linha: int) -> list[Parada]:
        await asyncio.sleep(0.01)
        return _criar_paradas(6)

    mock_cliente.buscar_paradas.side_effect = buscar_lento
    servico = ServicoConsulta(mock_cliente)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)

    r1, r2 = await asyncio.gather(
        servico.consultar_paradas(linha),
        servico.consultar_paradas(linha),
    )

    assert mock_cliente.buscar_paradas.await_count == 1
    assert r1 == r2


@pytest.mark.asyncio
async def test_consultar_previsoes_usa_cache_com_ttl_curto_e_relogio_simulado(mock_cliente: AsyncMock):
    agora = [2000.0]
    parada = Parada(codigo=440016921)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    horario_inicial = datetime(2026, 11, 4, 14, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))

    mock_cliente.obter_previsoes.side_effect = [
        ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=horario_inicial,
            horario_referencia="14:00",
            estado=EstadoConsulta.SUCESSO,
            previsoes=[
                PrevisaoChegada(horario_previsto="14:08", veiculo=Veiculo(prefixo="102")),
                PrevisaoChegada(horario_previsto="14:03", veiculo=Veiculo(prefixo="101")),
            ],
        ),
        ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=horario_inicial,
            horario_referencia="14:01",
            estado=EstadoConsulta.SUCESSO,
            previsoes=[
                PrevisaoChegada(horario_previsto="14:02", veiculo=Veiculo(prefixo="101")),
            ],
        ),
    ]
    servico = ServicoConsulta(
        mock_cliente,
        relogio=lambda: agora[0],
        ttl_previsoes_segundos=15.0,
    )

    primeira = await servico.consultar_previsoes(parada, linha)
    agora[0] += 14.0
    segunda = await servico.consultar_previsoes(parada, linha)

    assert mock_cliente.obter_previsoes.await_count == 1
    assert primeira.desatualizado is False
    assert segunda.desatualizado is False
    # Verifica ordenação preservada no cache
    assert [p.veiculo.prefixo for p in segunda.previsoes] == ["101", "102"]

    agora[0] += 2.0  # 16s: expirou o TTL curto
    terceira = await servico.consultar_previsoes(parada, linha)
    assert mock_cliente.obter_previsoes.await_count == 2
    assert terceira.horario_referencia == "14:01"
    assert terceira.desatualizado is False


@pytest.mark.asyncio
async def test_consultar_previsoes_estado_sem_previsao_tambem_usa_cache(mock_cliente: AsyncMock):
    agora = [3000.0]
    parada = Parada(codigo=440016921)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    mock_cliente.obter_previsoes.return_value = ConsultaPrevisao(
        parada=parada,
        linha=linha,
        horario_consulta=datetime(2026, 11, 4, 23, 30, tzinfo=ZoneInfo("America/Sao_Paulo")),
        horario_referencia="23:30",
        estado=EstadoConsulta.SEM_PREVISAO,
        previsoes=[],
    )
    servico = ServicoConsulta(mock_cliente, relogio=lambda: agora[0], ttl_previsoes_segundos=15.0)

    r1 = await servico.consultar_previsoes(parada, linha)
    agora[0] += 5.0
    r2 = await servico.consultar_previsoes(parada, linha)

    assert mock_cliente.obter_previsoes.await_count == 1
    assert r1.estado == EstadoConsulta.SEM_PREVISAO
    assert r2.estado == EstadoConsulta.SEM_PREVISAO
    assert r2.desatualizado is False


@pytest.mark.asyncio
async def test_consultar_previsoes_simultaneas_fazem_uma_chamada(mock_cliente: AsyncMock):
    parada = Parada(codigo=440016921)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)

    async def obter_lento(_cp: int, _cl: int) -> ConsultaPrevisao:
        await asyncio.sleep(0.01)
        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime(2026, 11, 4, 14, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
            horario_referencia="14:00",
            estado=EstadoConsulta.SUCESSO,
            previsoes=[PrevisaoChegada(horario_previsto="14:05", veiculo=Veiculo(prefixo="200"))],
        )

    mock_cliente.obter_previsoes.side_effect = obter_lento
    servico = ServicoConsulta(mock_cliente)

    r1, r2 = await asyncio.gather(
        servico.consultar_previsoes(parada, linha),
        servico.consultar_previsoes(parada, linha),
    )

    assert mock_cliente.obter_previsoes.await_count == 1
    assert r1.previsoes == r2.previsoes


# ==========================================
# ISS-11.2: Fallback em Caso de Queda da API
# ==========================================


@pytest.mark.asyncio
async def test_buscar_linhas_serve_ultimo_resultado_desatualizado_quando_api_cai(mock_cliente: AsyncMock):
    agora = [100.0]
    parada = Parada(codigo=440016921)
    linhas_validas = [
        Linha(codigo=1, numero="8000-10", sentido=1, origem="LAPA", destino="CENTRO"),
        Linha(codigo=2, numero="917H-10", sentido=1, origem="PIRITUBA", destino="VILA MARIANA"),
    ]
    linhas_novas = [
        Linha(codigo=1, numero="8000-10", sentido=1, origem="LAPA", destino="CENTRO"),
    ]
    mock_cliente.buscar_linhas_com_previsao.side_effect = [
        linhas_validas,
        SPTransIndisponivel("Timeout na SPTrans"),
        linhas_novas,
    ]
    servico = ServicoConsulta(mock_cliente, relogio=lambda: agora[0], ttl_linhas_segundos=60.0)

    inicial = await servico.buscar_linhas(parada)
    assert inicial == linhas_validas
    assert inicial.desatualizado is False

    # Expira o TTL e simula queda da API
    agora[0] += 61.0
    em_queda = await servico.buscar_linhas(parada, termo="917H")
    assert len(em_queda) == 1
    assert em_queda[0].numero == "917H-10"
    assert em_queda.desatualizado is True

    # Quando a SPTrans volta, serve os dados frescos com desatualizado=False
    recuperada = await servico.buscar_linhas(parada)
    assert recuperada == linhas_novas
    assert recuperada.desatualizado is False


@pytest.mark.asyncio
async def test_buscar_linhas_sem_cache_anterior_propaga_erro_da_sptrans(mock_cliente: AsyncMock):
    mock_cliente.buscar_linhas_com_previsao.side_effect = SPTransIndisponivel("Fora do ar")
    servico = ServicoConsulta(mock_cliente)

    with pytest.raises(SPTransIndisponivel):
        await servico.buscar_linhas(Parada(codigo=440016921))


@pytest.mark.asyncio
async def test_consultar_paradas_serve_ultimo_resultado_desatualizado_quando_api_cai(mock_cliente: AsyncMock):
    agora = [100.0]
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    paradas_iniciais = _criar_paradas(11)
    mock_cliente.buscar_paradas.side_effect = [
        paradas_iniciais,
        SPTransIndisponivel("SPTrans fora do ar"),
        _criar_paradas(3),
    ]
    servico = ServicoConsulta(mock_cliente, relogio=lambda: agora[0], ttl_paradas_segundos=3600.0)

    inicial = await servico.consultar_paradas(linha, limite_numero_paradas=5)
    assert len(inicial) == 5
    assert inicial.desatualizado is False

    agora[0] += 3601.0
    em_queda = await servico.consultar_paradas(linha, limite_numero_paradas=5)
    assert em_queda == inicial
    assert em_queda.desatualizado is True

    recuperada = await servico.consultar_paradas(linha, limite_numero_paradas=5)
    assert len(recuperada) == 3
    assert recuperada.desatualizado is False


@pytest.mark.asyncio
async def test_consultar_paradas_sem_cache_anterior_propaga_erro_da_sptrans(mock_cliente: AsyncMock):
    mock_cliente.buscar_paradas.side_effect = SPTransIndisponivel("Fora do ar")
    servico = ServicoConsulta(mock_cliente)

    with pytest.raises(SPTransIndisponivel):
        await servico.consultar_paradas(Linha(codigo=2506, numero="8000-10", sentido=1))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "excecao",
    [
        SPTransIndisponivel("Timeout"),
        ErroAutenticacaoSPTrans("Token expirado"),
        ErroSPTrans("Resposta 502"),
    ],
)
async def test_consultar_previsoes_serve_ultimo_resultado_desatualizado_quando_api_cai(
    mock_cliente: AsyncMock,
    excecao: Exception,
):
    agora = [500.0]
    parada = Parada(codigo=440016921)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    consulta_valida = ConsultaPrevisao(
        parada=parada,
        linha=linha,
        horario_consulta=datetime(2026, 11, 4, 15, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
        horario_referencia="15:00",
        estado=EstadoConsulta.SUCESSO,
        previsoes=[PrevisaoChegada(horario_previsto="15:04", veiculo=Veiculo(prefixo="81506"))],
    )
    consulta_recuperada = ConsultaPrevisao(
        parada=parada,
        linha=linha,
        horario_consulta=datetime(2026, 11, 4, 15, 1, tzinfo=ZoneInfo("America/Sao_Paulo")),
        horario_referencia="15:01",
        estado=EstadoConsulta.SUCESSO,
        previsoes=[PrevisaoChegada(horario_previsto="15:03", veiculo=Veiculo(prefixo="81506"))],
    )
    mock_cliente.obter_previsoes.side_effect = [
        consulta_valida,
        excecao,
        consulta_recuperada,
    ]
    servico = ServicoConsulta(mock_cliente, relogio=lambda: agora[0], ttl_previsoes_segundos=15.0)

    inicial = await servico.consultar_previsoes(parada, linha)
    assert inicial.desatualizado is False
    assert inicial.mensagem_erro == ""

    agora[0] += 16.0
    em_queda = await servico.consultar_previsoes(parada, linha)
    assert em_queda.estado == EstadoConsulta.SUCESSO
    assert em_queda.desatualizado is True
    assert em_queda.horario_referencia == "15:00"
    assert [p.veiculo.prefixo for p in em_queda.previsoes] == ["81506"]
    assert em_queda.mensagem_erro != ""

    recuperada = await servico.consultar_previsoes(parada, linha)
    assert recuperada.desatualizado is False
    assert recuperada.horario_referencia == "15:01"
    assert recuperada.mensagem_erro == ""


@pytest.mark.asyncio
async def test_consultar_previsoes_sem_cache_anterior_retorna_estado_falha_e_nao_cacheia_erro(
    mock_cliente: AsyncMock,
):
    parada = Parada(codigo=440016921)
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    mock_cliente.obter_previsoes.side_effect = [
        SPTransIndisponivel("Timeout"),
        ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime(2026, 11, 4, 15, 2, tzinfo=ZoneInfo("America/Sao_Paulo")),
            horario_referencia="15:02",
            estado=EstadoConsulta.SUCESSO,
            previsoes=[PrevisaoChegada(horario_previsto="15:06", veiculo=Veiculo(prefixo="999"))],
        ),
    ]
    servico = ServicoConsulta(mock_cliente, ttl_previsoes_segundos=15.0)

    falha = await servico.consultar_previsoes(parada, linha)
    assert falha.estado == EstadoConsulta.FALHA
    assert falha.desatualizado is False
    assert falha.previsoes == []

    # Como a falha não foi cacheada, uma nova chamada imediata já tenta a SPTrans novamente
    sucesso = await servico.consultar_previsoes(parada, linha)
    assert mock_cliente.obter_previsoes.await_count == 2
    assert sucesso.estado == EstadoConsulta.SUCESSO
    assert sucesso.desatualizado is False
