from dataclasses import dataclass
from datetime import datetime

from .veiculo import Veiculo

_MINUTOS_POR_DIA = 24 * 60
_MEIO_DIA_EM_MINUTOS = _MINUTOS_POR_DIA // 2


def _para_minutos_do_dia(valor: datetime | str) -> int:
    if isinstance(valor, datetime):
        return valor.hour * 60 + valor.minute
    if isinstance(valor, str):
        partes = valor.strip().split(":")
        if len(partes) != 2:
            raise ValueError(f"Horário inválido (esperado HH:MM): {valor!r}")
        hora, minuto = int(partes[0]), int(partes[1])
        if not (0 <= hora < 24 and 0 <= minuto < 60):
            raise ValueError(f"Horário fora do intervalo válido: {valor!r}")
        return hora * 60 + minuto
    raise TypeError(f"Tipo de referência não suportado: {type(valor).__name__}")


@dataclass
class PrevisaoChegada:
    horario_previsto: str  # "HH:MM", como informado pela SPTrans
    veiculo: Veiculo

    def calcular_tempo_de_espera(self, referencia: datetime | str) -> int:
        """Minutos de espera a partir de uma referência temporal.

        Trata a virada de meia-noite (ex.: previsão "00:03" com referência "23:58" -> 5)
        e nunca retorna valor negativo (previsões no passado retornam 0).
        """
        minutos_previsto = _para_minutos_do_dia(self.horario_previsto)
        minutos_referencia = _para_minutos_do_dia(referencia)

        diferenca = minutos_previsto - minutos_referencia
        if diferenca < -_MEIO_DIA_EM_MINUTOS:
            diferenca += _MINUTOS_POR_DIA
        elif diferenca > _MEIO_DIA_EM_MINUTOS:
            diferenca -= _MINUTOS_POR_DIA

        return max(0, diferenca)
