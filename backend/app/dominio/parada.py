from dataclasses import dataclass


@dataclass
class Parada:
    codigo: int
    nome: str = ""
    endereco: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
