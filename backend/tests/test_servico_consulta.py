import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.dominio import Linha, Parada
from app.servicos.cliente_sptrans import ClienteSPTrans
from app.servicos.servico_consulta import ServicoConsulta

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _criar_paradas(quantidade: int) -> list[Parada]:
    """Helper para gerar uma sequência sintética de paradas."""
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
    """Mock assíncrono do ClienteSPTrans."""
    return AsyncMock(spec=ClienteSPTrans)


@pytest.fixture
def servico(mock_cliente: AsyncMock) -> ServicoConsulta:
    return ServicoConsulta(cliente=mock_cliente)


@pytest.mark.asyncio
async def test_consultar_paradas_linha_sem_paradas(servico: ServicoConsulta, mock_cliente: AsyncMock):
    """Garante que linha sem paradas cadastradas retorna lista vazia."""
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
    """Linhas com total de paradas <= limite (padrão 5) devem ser retornadas integralmente."""
    paradas_originais = _criar_paradas(quantidade)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=1002, numero="8000-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == quantidade
    assert resultado == paradas_originais


@pytest.mark.asyncio
async def test_consultar_paradas_linha_longa_amostragem_uniforme(servico: ServicoConsulta, mock_cliente: AsyncMock):
    """Linha com 21 paradas deve retornar exatamente 5 paradas espaçadas uniformemente."""
    # Índices esperados para n=21 e k=5 com round(i * 20 / 4):
    # i=0 -> 0; i=1 -> 5; i=2 -> 10; i=3 -> 15; i=4 -> 20
    paradas_originais = _criar_paradas(21)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=2001, numero="175P-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == 5
    # Primeira e última parada (origem e destino final) obrigatoriamente preservadas
    assert resultado[0] == paradas_originais[0]
    assert resultado[-1] == paradas_originais[20]
    # Paradas intermediárias
    assert resultado[1] == paradas_originais[5]
    assert resultado[2] == paradas_originais[10]
    assert resultado[3] == paradas_originais[15]


@pytest.mark.asyncio
async def test_consultar_paradas_borda_logo_acima_do_limite(servico: ServicoConsulta, mock_cliente: AsyncMock):
    """Linha com 6 paradas (limite 5) não deve duplicar elementos nem ultrapassar o limite."""
    # Índices esperados para n=6 e k=5 com round(i * 5 / 4):
    # i=0 -> 0; i=1 -> 1; i=2 -> 2; i=3 -> 4; i=4 -> 5
    paradas_originais = _criar_paradas(6)
    mock_cliente.buscar_paradas.return_value = paradas_originais
    linha = Linha(codigo=2002, numero="175P-10", sentido=1)

    resultado = await servico.consultar_paradas(linha, limite_numero_paradas=5)

    assert len(resultado) == 5
    assert resultado[0] == paradas_originais[0]
    assert resultado[-1] == paradas_originais[5]
    # Garantir que não há elementos duplicados
    codigos = [p.codigo for p in resultado]
    assert len(codigos) == len(set(codigos))


@pytest.mark.asyncio
async def test_consultar_paradas_limite_customizado(servico: ServicoConsulta, mock_cliente: AsyncMock):
    """Permite configurar um limite diferente de paradas principais (ex.: k=3)."""
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
    """Testa a simplificação a partir de dados reais da SPTrans (13 paradas reais da linha 1273)."""
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

    # Primeira parada real da linha (Origem)
    assert resultado[0].nome == "BABY BARIONY C/B"
    assert resultado[0].codigo == 614432

    # Última parada real da linha (Destino)
    assert resultado[-1].nome == "NOTHMANN C/B"
    assert resultado[-1].codigo == 700016865

    # Sem duplicatas
    codigos = [p.codigo for p in resultado]
    assert len(codigos) == len(set(codigos))
