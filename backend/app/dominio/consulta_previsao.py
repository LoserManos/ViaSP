from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from .linha import Linha
from .parada import Parada
from .previsao_chegada import PrevisaoChegada


class EstadoConsulta(str, Enum):
    """Distingue sucesso, ausência de previsão e falha (US07 / US08)."""

    SUCESSO = "sucesso"
    SEM_PREVISAO = "sem_previsao"
    FALHA = "falha"


@dataclass
class ConsultaPrevisao:
    parada: Parada
    linha: Linha
    horario_consulta: datetime
    horario_referencia: str = ""  # "hr" informado pela SPTrans
    estado: EstadoConsulta = EstadoConsulta.SUCESSO
    previsoes: list[PrevisaoChegada] = field(default_factory=list)
    mensagem_erro: str = ""  # NOVO CAMPO AQUI

    def foi_bem_sucedida(self) -> bool:
        return self.estado in (EstadoConsulta.SUCESSO, EstadoConsulta.SEM_PREVISAO)

    def possui_previsoes(self) -> bool:
        return self.estado == EstadoConsulta.SUCESSO and len(self.previsoes) > 0
