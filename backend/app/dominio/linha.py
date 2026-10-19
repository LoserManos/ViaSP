from dataclasses import dataclass


@dataclass
class Linha:
    """Uma linha em um sentido de operação.

    `codigo` é o código usado pela SPTrans (identifica linha + sentido).
    """

    codigo: int
    numero: str  # letreiro, ex.: "8000-10"
    sentido: int  # 1 = principal -> secundário, 2 = secundário -> principal
    origem: str = ""
    destino: str = ""
