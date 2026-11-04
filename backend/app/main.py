import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.rotas import CABECALHO_DESATUALIZADO, router
from app.api.rotas_dev import router_dev
from app.config import get_settings
from app.dominio import Parada, Totem
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.persistencia import RepositorioParadas, inicializar_banco
from app.servicos import ClienteSPTrans, ServicoConsulta

logger = logging.getLogger(__name__)


def _carregar_gtfs(repositorio: RepositorioParadas, caminho: str) -> None:
    """Importa as paradas do GTFS na primeira subida (ou depois de apagar o banco)."""
    if repositorio.contar() > 0:
        return
    try:
        total = repositorio.importar_gtfs(caminho)
    except FileNotFoundError:
        logger.warning("GTFS não encontrado em %s; nomes e coordenadas virão só da SPTrans.", caminho)
        return
    logger.info("%d paradas importadas do GTFS (%s).", total, caminho)


async def _parada_do_totem(codigo: int, repositorio: RepositorioParadas, cliente: ClienteSPTrans) -> Parada:
    """ISS-13.3: dados da parada vêm do GTFS; se ela não estiver lá, da SPTrans."""
    parada = repositorio.buscar(codigo)
    if parada is not None:
        return parada
    try:
        parada = await cliente.buscar_parada(codigo)
    except ErroSPTrans as exc:
        # Se a SPTrans estiver fora do ar na subida, o totem ainda liga
        logger.warning("Não foi possível carregar os dados da parada na subida: %s", exc)
    if parada is None:
        logger.warning("Parada %s não está no GTFS nem na SPTrans.", codigo)
        parada = Parada(codigo=codigo, nome=f"Parada {codigo}")
    return parada


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    inicializar_banco(settings.banco_caminho)

    cliente = ClienteSPTrans(
        token=settings.sptrans_token,
        base_url=settings.sptrans_base_url,
        timeout=settings.sptrans_timeout_segundos,
    )

    repositorio_paradas = RepositorioParadas(settings.banco_caminho)
    _carregar_gtfs(repositorio_paradas, settings.gtfs_caminho)

    app.state.repositorio_paradas = repositorio_paradas
    app.state.servico_consulta = ServicoConsulta(
        cliente,
        ttl_linhas_segundos=settings.cache_ttl_linhas_segundos,
        ttl_paradas_segundos=settings.cache_ttl_paradas_segundos,
        ttl_previsoes_segundos=settings.cache_ttl_previsoes_segundos,
    )
    app.state.totem = Totem(
        identificador=settings.totem_identificador,
        parada=await _parada_do_totem(settings.parada_codigo, repositorio_paradas, cliente),
    )
    yield
    await cliente.fechar()


def _resposta_erro(status: int, codigo: str, mensagem: str, tentar_novamente: bool) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"codigo": codigo, "mensagem": mensagem, "tentar_novamente": tentar_novamente},
    )


def criar_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="ViaSP - Backend do Totem", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origens,
        allow_methods=["GET", "PUT"],
        allow_headers=["*"],
        expose_headers=[CABECALHO_DESATUALIZADO],
    )
    app.include_router(router)
    if settings.modo_dev:
        app.include_router(router_dev)

    # Mensagens claras de erro para o totem (US08), no formato de docs/produto/api.md
    @app.exception_handler(NotImplementedError)
    async def _nao_implementado(_: Request, __: NotImplementedError):
        return _resposta_erro(501, "nao_implementado", "Funcionalidade ainda não implementada.", False)

    @app.exception_handler(RequestValidationError)
    async def _requisicao_invalida(_: Request, __: RequestValidationError):
        return _resposta_erro(422, "requisicao_invalida", "Parâmetros da requisição inválidos.", False)

    @app.exception_handler(ErroAutenticacaoSPTrans)
    async def _erro_auth(_: Request, __: ErroAutenticacaoSPTrans):
        return _resposta_erro(502, "erro_autenticacao", "Falha de autenticação com a SPTrans.", True)

    @app.exception_handler(SPTransIndisponivel)
    async def _indisponivel(_: Request, __: SPTransIndisponivel):
        return _resposta_erro(503, "sptrans_indisponivel", "SPTrans indisponível no momento. Tente novamente.", True)

    @app.exception_handler(ErroSPTrans)
    async def _erro_sptrans(_: Request, __: ErroSPTrans):
        return _resposta_erro(502, "erro_sptrans", "Erro ao consultar a SPTrans.", True)

    return app


app = criar_app()
