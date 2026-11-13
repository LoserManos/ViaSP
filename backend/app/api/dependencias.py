from fastapi import Request

from app.dominio import Totem
from app.persistencia import RepositorioLogs, RepositorioParadas
from app.servicos import ServicoConsulta


def get_servico_consulta(request: Request) -> ServicoConsulta:
    return request.app.state.servico_consulta


def get_totem(request: Request) -> Totem:
    return request.app.state.totem


def get_repositorio_paradas(request: Request) -> RepositorioParadas:
    return request.app.state.repositorio_paradas


def get_repositorio_logs(request: Request) -> RepositorioLogs:
    return request.app.state.repositorio_logs
