from datetime import datetime

import pytest

from app.dominio import (
    ConsultaPrevisao,
    EstadoConsulta,
    Linha,
    Parada,
    PrevisaoChegada,
    Totem,
    Veiculo,
)


def _nova_consulta(
    estado: EstadoConsulta = EstadoConsulta.SUCESSO,
    previsoes: list[PrevisaoChegada] | None = None,
) -> ConsultaPrevisao:
    return ConsultaPrevisao(
        parada=Parada(codigo=1),
        linha=Linha(codigo=1, numero="8000-10", sentido=1),
        horario_consulta=datetime(2026, 10, 25, 14, 0),
        horario_referencia="14:00",
        estado=estado,
        previsoes=previsoes if previsoes is not None else [],
    )


def test_consulta_sem_previsoes_comeca_vazia():
    consulta = ConsultaPrevisao(
        parada=Parada(codigo=1),
        linha=Linha(codigo=1, numero="8000-10", sentido=1),
        horario_consulta=datetime.now(),
    )
    assert consulta.previsoes == []
    assert consulta.estado == EstadoConsulta.SUCESSO


def test_possui_previsoes():
    previsao = PrevisaoChegada(horario_previsto="14:05", veiculo=Veiculo(prefixo="12345"))

    com_previsao = _nova_consulta(estado=EstadoConsulta.SUCESSO, previsoes=[previsao])
    sem_previsao_lista_vazia = _nova_consulta(estado=EstadoConsulta.SUCESSO, previsoes=[])
    estado_sem_previsao = _nova_consulta(estado=EstadoConsulta.SEM_PREVISAO, previsoes=[])
    estado_falha = _nova_consulta(estado=EstadoConsulta.FALHA, previsoes=[previsao])

    assert com_previsao.possui_previsoes() is True
    assert sem_previsao_lista_vazia.possui_previsoes() is False
    assert estado_sem_previsao.possui_previsoes() is False
    assert estado_falha.possui_previsoes() is False


@pytest.mark.parametrize(
    ("estado", "esperado"),
    [
        (EstadoConsulta.SUCESSO, True),
        (EstadoConsulta.SEM_PREVISAO, True),
        (EstadoConsulta.FALHA, False),
    ],
)
def test_foi_bem_sucedida_nos_tres_estados(estado: EstadoConsulta, esperado: bool):
    consulta = _nova_consulta(estado=estado)
    assert consulta.foi_bem_sucedida() is esperado


def test_calcular_tempo_de_espera_normal_com_string_e_datetime():
    previsao = PrevisaoChegada(horario_previsto="14:25", veiculo=Veiculo(prefixo="1001"))

    assert previsao.calcular_tempo_de_espera("14:10") == 15
    assert previsao.calcular_tempo_de_espera(datetime(2026, 10, 25, 14, 10)) == 15


def test_calcular_tempo_de_espera_zero():
    previsao = PrevisaoChegada(horario_previsto="14:10", veiculo=Veiculo(prefixo="1001"))

    assert previsao.calcular_tempo_de_espera("14:10") == 0
    assert previsao.calcular_tempo_de_espera(datetime(2026, 10, 25, 14, 10, 45)) == 0


def test_calcular_tempo_de_espera_virada_de_meia_noite():
    previsao = PrevisaoChegada(horario_previsto="00:03", veiculo=Veiculo(prefixo="1001"))

    assert previsao.calcular_tempo_de_espera("23:58") == 5
    assert previsao.calcular_tempo_de_espera(datetime(2026, 10, 25, 23, 58)) == 5


def test_calcular_tempo_de_espera_previsao_no_passado_nunca_negativa():
    previsao_mesmo_dia = PrevisaoChegada(horario_previsto="14:05", veiculo=Veiculo(prefixo="1001"))
    assert previsao_mesmo_dia.calcular_tempo_de_espera("14:10") == 0
    assert previsao_mesmo_dia.calcular_tempo_de_espera(datetime(2026, 10, 25, 14, 10)) == 0

    previsao_antes_meia_noite = PrevisaoChegada(horario_previsto="23:58", veiculo=Veiculo(prefixo="1001"))
    assert previsao_antes_meia_noite.calcular_tempo_de_espera("00:02") == 0


def test_totem_guarda_configuracao_da_parada():
    parada = Parada(codigo=42, nome="Parada Teste")
    totem = Totem(identificador="totem-001", parada=parada)

    assert totem.identificador == "totem-001"
    assert totem.parada == parada
