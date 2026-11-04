"""Rotas HTTP. Tudo sob /api.

Rotas de consulta delegam ao ServicoConsulta. Erros viram respostas no formato
padrão de docs/produto/api.md (ver handlers em app/main.py).
"""
from fastapi import APIRouter, Depends, Response

from app.dominio import Linha, Totem
from app.servicos import ServicoConsulta

from .dependencias import get_servico_consulta, get_totem
from .schemas import (
    ConsultaPrevisaoSchema,
    LinhaSchema,
    ParadaSchema,
    TotemSchema,
)

CABECALHO_DESATUALIZADO = "X-Dados-Desatualizados"

router = APIRouter(prefix="/api")


def _marcar_cabecalho_desatualizado(response: Response, resultado: object) -> None:
    response.headers[CABECALHO_DESATUALIZADO] = (
        "true" if getattr(resultado, "desatualizado", False) else "false"
    )


@router.get("/saude")
async def saude() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/totem", response_model=TotemSchema)
async def obter_totem(totem: Totem = Depends(get_totem)):
    return totem


@router.get("/linhas", response_model=list[LinhaSchema])
async def listar_linhas(
    response: Response,
    termo: str = "",
    totem: Totem = Depends(get_totem),
    servico: ServicoConsulta = Depends(get_servico_consulta),
):
    """US01 / US02: linhas do ponto, com busca opcional."""
    linhas = await servico.buscar_linhas(totem.parada, termo)
    _marcar_cabecalho_desatualizado(response, linhas)
    return linhas


@router.get("/linhas/{codigo_linha}/paradas", response_model=list[ParadaSchema])
async def listar_paradas_da_linha(
    codigo_linha: int,
    response: Response,
    servico: ServicoConsulta = Depends(get_servico_consulta),
):
    """US03: itinerário simplificado da linha."""
    paradas = await servico.consultar_paradas(Linha(codigo=codigo_linha, numero="", sentido=1))
    _marcar_cabecalho_desatualizado(response, paradas)
    return paradas


@router.get("/previsoes", response_model=ConsultaPrevisaoSchema)
async def consultar_previsoes(
    codigo_linha: int,
    response: Response,
    totem: Totem = Depends(get_totem),
    servico: ServicoConsulta = Depends(get_servico_consulta),
):
    """US06 / US07 / US08: previsão para a parada do totem e a linha escolhida."""
    linha = Linha(codigo=codigo_linha, numero="", sentido=1)
    consulta = await servico.consultar_previsoes(totem.parada, linha)
    _marcar_cabecalho_desatualizado(response, consulta)
    return consulta
