"""Modelos de resposta da API (o que o frontend recebe)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.dominio import EstadoConsulta


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ParadaSchema(_Base):
    codigo: int
    nome: str
    endereco: str
    latitude: float
    longitude: float


class LinhaSchema(_Base):
    codigo: int
    numero: str
    sentido: int
    origem: str
    destino: str


class VeiculoSchema(_Base):
    prefixo: str


class PrevisaoChegadaSchema(_Base):
    horario_previsto: str
    veiculo: VeiculoSchema


class ConsultaPrevisaoSchema(_Base):
    parada: ParadaSchema
    linha: LinhaSchema
    horario_consulta: datetime
    horario_referencia: str
    estado: EstadoConsulta
    mensagem_erro: str
    previsoes: list[PrevisaoChegadaSchema]


class TotemSchema(_Base):
    identificador: str
    parada: ParadaSchema
