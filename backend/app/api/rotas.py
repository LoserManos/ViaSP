"""Rotas HTTP. Tudo sob /api.

Rotas de consulta delegam ao ServicoConsulta. Erros viram respostas no formato
padrão de docs/produto/api.md (ver handlers em app/main.py).
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, Response

from app.dominio import ConsultaPrevisao, Linha, Parada, Totem
from app.persistencia import RepositorioLogs, RepositorioParadas
from app.servicos import ServicoConsulta

from .dependencias import get_repositorio_logs, get_repositorio_paradas, get_servico_consulta, get_totem
from .schemas import (
    ConsultaPrevisaoSchema,
    LinhaSchema,
    ParadaSchema,
    TotemSchema,
)

logger = logging.getLogger(__name__)

CABECALHO_DESATUALIZADO = "X-Dados-Desatualizados"

router = APIRouter(prefix="/api")


def _marcar_cabecalho_desatualizado(response: Response, resultado: object) -> None:
    response.headers[CABECALHO_DESATUALIZADO] = "true" if getattr(resultado, "desatualizado", False) else "false"


def _registrar_log_consulta(
    repositorio_logs: RepositorioLogs,
    totem_id: str,
    consulta: ConsultaPrevisao,
) -> None:
    """Executa o registro do log em segundo plano sem propagar falhas do banco."""
    try:
        repositorio_logs.registrar_consulta(
            totem_id=totem_id,
            consulta=consulta,
            latencia_ms=consulta.latencia_ms,
            erro=consulta.mensagem_erro or None,
        )
    except Exception as exc:
        logger.warning("Falha ao registrar log de consulta em segundo plano: %s", exc)


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

    _marcar_cabecalho_desatualizado(response, paradas)
    return paradas


@router.get("/previsoes", response_model=ConsultaPrevisaoSchema)
async def consultar_previsoes(
    codigo_linha: int,
    response: Response,
    background_tasks: BackgroundTasks,
    totem: Totem = Depends(get_totem),
    servico: ServicoConsulta = Depends(get_servico_consulta),
    repositorio_logs: RepositorioLogs = Depends(get_repositorio_logs),
):
    """US06 / US07 / US08: previsão para a parada do totem e a linha escolhida."""
    linha = Linha(codigo=codigo_linha, numero="", sentido=1)
    consulta = await servico.consultar_previsoes(totem.parada, linha)
    _marcar_cabecalho_desatualizado(response, consulta)
    background_tasks.add_task(_registrar_log_consulta, repositorio_logs, totem.identificador, consulta)
    return consulta
