from dataclasses import dataclass

from .parada import Parada


@dataclass
class Totem:
    """Totem instalado em uma parada.

    Representa no backend a configuração física do terminal (identificador e
    parada associada). As interações de navegação do passageiro (buscar/selecionar
    linha e voltar ao início) pertencem à camada de interface (frontend).
    """

    identificador: str
    parada: Parada
