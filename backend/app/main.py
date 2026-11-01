import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.rotas import router
from app.config import get_settings
from app.dominio import Parada, Totem
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.persistencia import inicializar_banco
from app.servicos import ClienteSPTrans, ServicoConsulta

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    inicializar_banco(settings.banco_caminho)

    cliente = ClienteSPTrans(
        token=settings.sptrans_token,
        base_url=settings.sptrans_base_url,
        timeout=settings.sptrans_timeout_segundos,
    )

    # ISS-13.3: dados reais da parada na subida; se a SPTrans não os tiver, vale a configuração
    parada_configurada = Parada(
        codigo=settings.parada_codigo,
        nome=settings.parada_nome,
        endereco=settings.parada_endereco,
        latitude=settings.parada_latitude,
        longitude=settings.parada_longitude,
    )
    try:
        parada_real = await cliente.buscar_parada(settings.parada_codigo)
    except ErroSPTrans as exc:
        # Se a SPTrans estiver fora do ar na subida, o totem ainda liga
        logger.warning("Não foi possível carregar os dados da parada na subida: %s", exc)
        parada_real = None
    if parada_real is None:
        logger.warning("Parada %s sem dados na SPTrans; usando a configuração.", settings.parada_codigo)
        parada_real = parada_configurada

    app.state.servico_consulta = ServicoConsulta(cliente)
    app.state.totem = Totem(
        identificador=settings.totem_identificador,
        parada=parada_real,
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
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    app.include_router(router)

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
