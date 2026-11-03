"""Rotas HTTP. Tudo sob /api.

Rotas de consulta delegam ao ServicoConsulta. Erros viram respostas no formato
padrão de docs/produto/api.md (ver handlers em app/main.py).
"""
from fastapi import APIRouter, Depends

from app.dominio import Linha, Parada, Totem
from app.persistencia import RepositorioParadas
from app.servicos import ServicoConsulta

from .dependencias import get_repositorio_paradas, get_servico_consulta, get_totem
from .schemas import (
    ConsultaPrevisaoSchema,
    LinhaSchema,
    ParadaSchema,
    TotemSchema,
)

router = APIRouter(prefix="/api")


@router.get("/saude")
async def saude() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/totem", response_model=TotemSchema)
async def obter_totem(totem: Totem = Depends(get_totem)):
    return totem


@router.get("/linhas", response_model=list[LinhaSchema])
async def listar_linhas(
    termo: str = "",
    totem: Totem = Depends(get_totem),
    servico: ServicoConsulta = Depends(get_servico_consulta),
):
    """US01 / US02: linhas do ponto, com busca opcional."""
    return await servico.buscar_linhas(totem.parada, termo)


@router.get("/linhas/{codigo_linha}/paradas", response_model=list[ParadaSchema])
async def listar_paradas_da_linha(
    codigo_linha: int,
    numero: str | None = None,
    sentido: int | None = None,
    destino: str | None = None,
    limite: int | None = None,
    servico: ServicoConsulta = Depends(get_servico_consulta),
    repositorio_paradas: RepositorioParadas = Depends(get_repositorio_paradas),
):
    """US03: itinerário da linha com todas as suas paradas (GTFS com fallback para Olho Vivo)."""
    paradas: list[Parada] = []

    if numero:
        paradas = repositorio_paradas.buscar_itinerario_linha(
            numero_linha=numero,
            destino=destino or "",
            sentido=sentido,
        )

    if not paradas:
        paradas = await servico.consultar_paradas(
            Linha(codigo=codigo_linha, numero=numero or "", sentido=sentido or 1),
            limite_numero_paradas=limite,
        )
        for parada in paradas:
            if not parada.nome.strip():
                gtfs = repositorio_paradas.buscar(parada.codigo)
                if gtfs:
                    parada.nome = gtfs.nome
                    if not parada.endereco.strip():
                        parada.endereco = gtfs.endereco
                else:
                    parada.nome = f"Parada #{parada.codigo}"

    return paradas


@router.get("/previsoes", response_model=ConsultaPrevisaoSchema)
async def consultar_previsoes(
    codigo_linha: int,
    totem: Totem = Depends(get_totem),
    servico: ServicoConsulta = Depends(get_servico_consulta),
):
    """US06 / US07 / US08: previsão para a parada do totem e a linha escolhida."""
    linha = Linha(codigo=codigo_linha, numero="", sentido=1)
    return await servico.consultar_previsoes(totem.parada, linha)
