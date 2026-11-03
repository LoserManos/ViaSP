"""Rotas de desenvolvimento, só registradas com `python -m app --dev`.

Na versão final cada totem tem a parada fixa na configuração. Para a
demonstração, estas rotas deixam escolher a parada num mapa com todas as
paradas do GTFS, sem reiniciar o backend.
"""
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.dominio import Totem
from app.persistencia import RepositorioParadas

from .dependencias import get_repositorio_paradas, get_totem
from .schemas import ParadaSchema, TotemSchema

router_dev = APIRouter(prefix="/api/dev", tags=["dev"])


class ParadasNaAreaSchema(BaseModel):
    paradas: list[ParadaSchema]
    truncado: bool


class EscolhaParadaSchema(BaseModel):
    codigo: int


@router_dev.get("/paradas", response_model=ParadasNaAreaSchema)
def listar_paradas_na_area(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    limite: int = Query(500, ge=1, le=2000),
    repositorio: RepositorioParadas = Depends(get_repositorio_paradas),
):
    """Paradas dentro da área visível do mapa. `truncado` indica que há mais do que `limite`."""
    paradas = repositorio.buscar_na_area(lat_min, lat_max, lon_min, lon_max, limite + 1)
    return {"paradas": paradas[:limite], "truncado": len(paradas) > limite}


@router_dev.put("/parada", response_model=TotemSchema)
def escolher_parada(
    escolha: EscolhaParadaSchema,
    request: Request,
    totem: Totem = Depends(get_totem),
    repositorio: RepositorioParadas = Depends(get_repositorio_paradas),
):
    """Troca a parada do totem até o backend reiniciar (aí volta a valer PARADA_CODIGO)."""
    parada = repositorio.buscar(escolha.codigo)
    if parada is None:
        return JSONResponse(
            status_code=404,
            content={
                "codigo": "parada_nao_encontrada",
                "mensagem": "Parada não encontrada no GTFS.",
                "tentar_novamente": False,
            },
        )
    request.app.state.totem = Totem(identificador=totem.identificador, parada=parada)
    return request.app.state.totem
