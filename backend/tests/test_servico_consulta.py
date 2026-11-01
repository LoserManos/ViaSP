import json
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.dominio import (
    ConsultaPrevisao,
    EstadoConsulta,
    Linha,
    Parada,
    PrevisaoChegada,
    Veiculo,
)
from app.excecoes import SPTransIndisponivel
from app.servicos.cliente_sptrans import ClienteSPTrans
from app.servicos.servico_consulta import ServicoConsulta

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ==========================================
# Helpers e Fixtures
# ==========================================

class FakeClienteSPTrans:
    """Cliente falso para testes unitários do ServicoConsulta (ISS-08)."""
    def __init__(self, linhas_retorno: list[Linha]):
        self._linhas_retorno = linhas_retorno
        self.chamadas = 0

    async def buscar_linhas_da_parada(self, codigo_parada: int) -> list[Linha]:
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
# ISS-09: Previsões de Chegada
# ==========================================

@pytest.mark.asyncio
async def test_consultar_previsoes_sucesso_e_ordenacao():
    previsoes_desordenadas = [
        PrevisaoChegada(horario_previsto="12:10", veiculo=Veiculo(prefixo="A")),
        PrevisaoChegada(horario_previsto="12:02", veiculo=Veiculo(prefixo="B")),
    ]
    consulta_fake = ConsultaPrevisao(
        parada=Parada(codigo=123),
        linha=Linha(codigo=1, numero="8000", sentido=1),
        horario_consulta=datetime.now(),
        horario_referencia="12:00",
        estado=EstadoConsulta.SUCESSO,
        previsoes=previsoes_desordenadas
    )

    cliente_fake = AsyncMock()
    cliente_fake.obter_previsoes.return_value = consulta_fake
    servico = ServicoConsulta(cliente_fake)

    resultado = await servico.consultar_previsoes(Parada(codigo=123), Linha(codigo=1, numero="8000", sentido=1))

    assert resultado.estado == EstadoConsulta.SUCESSO
    assert len(resultado.previsoes) == 2
    assert resultado.previsoes[0].veiculo.prefixo == "B"
    assert resultado.previsoes[1].veiculo.prefixo == "A"


@pytest.mark.asyncio
async def test_consultar_previsoes_falha_de_comunicacao():
    cliente_fake = AsyncMock()
    cliente_fake.obter_previsoes.side_effect = SPTransIndisponivel("Timeout")
    servico = ServicoConsulta(cliente_fake)

    resultado = await servico.consultar_previsoes(Parada(codigo=123), Linha(codigo=1, numero="8000", sentido=1))

    assert resultado.estado == EstadoConsulta.FALHA
    assert resultado.foi_bem_sucedida() is False
    assert "indisponível" in resultado.mensagem_erro
    assert resultado.previsoes == []


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
