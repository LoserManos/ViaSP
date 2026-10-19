from fastapi import Request

from app.dominio import Totem
from app.servicos import ServicoConsulta


def get_servico_consulta(request: Request) -> ServicoConsulta:
    return request.app.state.servico_consulta


def get_totem(request: Request) -> Totem:
    return request.app.state.totem
