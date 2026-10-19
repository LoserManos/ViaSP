from dataclasses import dataclass

from .linha import Linha
from .parada import Parada


@dataclass
class Totem:
    """Totem instalado em uma parada.

    No diagrama de classes, as operações abaixo representam a interação do
    passageiro (hoje vivem no frontend). No backend o Totem guarda,
    sobretudo, a configuração (identificador + parada).
    """

    identificador: str
    parada: Parada

    def buscar_linha(self, termo: str) -> list[Linha]:
        raise NotImplementedError

    def selecionar_linha(self, linha: Linha) -> None:
        raise NotImplementedError

    def voltar_ao_inicio(self) -> None:
        raise NotImplementedError
