import pytest

from app.dominio import Linha, Parada
from app.servicos.servico_consulta import ServicoConsulta


class FakeClienteSPTrans:
    """Cliente falso para testes unitários do ServicoConsulta."""
    def __init__(self, linhas_retorno: list[Linha]):
        self._linhas_retorno = linhas_retorno
        self.chamadas = 0

    async def buscar_linhas_da_parada(self, codigo_parada: int) -> list[Linha]:
        self.chamadas += 1
        return self._linhas_retorno


@pytest.mark.asyncio
async def test_buscar_linhas_sem_termo_retorna_todas():
    # Prepara os dados falsos
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

    # Busca por "PAULISTA" (maiúsculo) deve achar "Paulista"
    resultado_maiusculo = await servico.buscar_linhas(parada, termo="PAULISTA")
    assert len(resultado_maiusculo) == 1
    assert resultado_maiusculo[0].numero == "9000"

    # Busca por "praca da se" (sem acento) deve achar "Praça da Sé"
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