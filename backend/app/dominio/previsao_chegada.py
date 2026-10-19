from dataclasses import dataclass
from datetime import datetime

from .veiculo import Veiculo


@dataclass
class PrevisaoChegada:
    horario_previsto: str  # "HH:MM", como informado pela SPTrans
    veiculo: Veiculo

    def calcular_tempo_de_espera(self, referencia: datetime | str) -> int:
        """Minutos de espera a partir de uma referência temporal."""
        raise NotImplementedError
