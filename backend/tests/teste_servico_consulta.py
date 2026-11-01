from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada, PrevisaoChegada, Veiculo
from app.excecoes import SPTransIndisponivel
from app.servicos.servico_consulta import ServicoConsulta


@pytest.mark.asyncio
async def test_consultar_previsoes_sucesso_e_ordenacao():
    # Previsões fora de ordem (espera de 10 min, depois 2 min)
    previsoes_desordenadas = [
        PrevisaoChegada(horario_previsto="12:10", veiculo=Veiculo(prefixo="A")),
        PrevisaoChegada(horario_previsto="12:02", veiculo=Veiculo(prefixo="B")),
    ]
    consulta_fake = ConsultaPrevisao(
        parada=Parada(codigo=123),
        linha=Linha(codigo=1, numero="8000", sentido=1),
        horario_consulta=datetime.now(),
        horario_referencia="12:00", # Referência para o cálculo
        estado=EstadoConsulta.SUCESSO,
        previsoes=previsoes_desordenadas
    )

    # Mock do cliente retornando a consulta
    cliente_fake = AsyncMock()
    cliente_fake.obter_previsoes.return_value = consulta_fake
    servico = ServicoConsulta(cliente_fake)

    resultado = await servico.consultar_previsoes(Parada(codigo=123), Linha(codigo=1, numero="8000", sentido=1))

    # Verifica se ordenou: a previsão das 12:02 (2 min) deve vir antes da 12:10 (10 min)
    assert resultado.estado == EstadoConsulta.SUCESSO
    assert len(resultado.previsoes) == 2
    assert resultado.previsoes[0].veiculo.prefixo == "B"
    assert resultado.previsoes[1].veiculo.prefixo == "A"


@pytest.mark.asyncio
async def test_consultar_previsoes_falha_de_comunicacao():
    # Mock do cliente lançando uma exceção de rede
    cliente_fake = AsyncMock()
    cliente_fake.obter_previsoes.side_effect = SPTransIndisponivel("Timeout")
    servico = ServicoConsulta(cliente_fake)

    resultado = await servico.consultar_previsoes(Parada(codigo=123), Linha(codigo=1, numero="8000", sentido=1))

    # O serviço não deve estourar a exceção, e sim retornar o estado FALHA
    assert resultado.estado == EstadoConsulta.FALHA
    assert resultado.foi_bem_sucedida() is False
    assert "indisponível" in resultado.mensagem_erro
    assert resultado.previsoes == []
