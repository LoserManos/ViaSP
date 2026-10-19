import pytest

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada


def test_consulta_sem_previsoes_comeca_vazia():
    consulta = ConsultaPrevisao(
        parada=Parada(codigo=1),
        linha=Linha(codigo=1, numero="8000-10", sentido=1),
        horario_consulta=__import__("datetime").datetime.now(),
    )
    assert consulta.previsoes == []
    assert consulta.estado == EstadoConsulta.SUCESSO


@pytest.mark.skip(reason="TODO: implementar ConsultaPrevisao.possui_previsoes")
def test_possui_previsoes():
    ...
