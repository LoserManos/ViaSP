from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.rotas import router
from app.config import get_settings
from app.dominio import Parada, Totem
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.persistencia import inicializar_banco
from app.servicos import ClienteSPTrans, ServicoConsulta


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    inicializar_banco(settings.banco_caminho)

    cliente = ClienteSPTrans(
        token=settings.sptrans_token,
        base_url=settings.sptrans_base_url,
        timeout=settings.sptrans_timeout_segundos,
    )

    # ISS-13.3: Buscar dados reais da parada na subida do servidor
    try:
        parada_real = await cliente.buscar_parada(settings.parada_codigo)
        if parada_real is None:
            # Fallback caso a SPTrans não encontre a parada
            parada_real = Parada(codigo=settings.parada_codigo)
    except Exception:
        # Se a SPTrans estiver fora do ar na subida, o totem ainda liga (com dados vazios)
        parada_real = Parada(codigo=settings.parada_codigo)

    app.state.servico_consulta = ServicoConsulta(cliente)
    app.state.totem = Totem(
        identificador=settings.totem_identificador,
        parada=parada_real,
    )
    yield
    await cliente.fechar()


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

    # Mensagens claras de erro para o totem (US08)
    @app.exception_handler(NotImplementedError)
    async def _nao_implementado(_: Request, __: NotImplementedError):
        return JSONResponse(
            status_code=501,
            content={"codigo": "nao_implementado",
                     "mensagem": "Funcionalidade ainda não implementada.",
                     "tentar_novamente": False}
        )

    @app.exception_handler(ErroAutenticacaoSPTrans)
    async def _erro_auth(_: Request, __: ErroAutenticacaoSPTrans):
        return JSONResponse(
            status_code=502,
            content={"codigo": "erro_autenticacao",
                     "mensagem": "Falha de autenticação com a SPTrans.",
                     "tentar_novamente": True}
        )

    @app.exception_handler(SPTransIndisponivel)
    async def _indisponivel(_: Request, __: SPTransIndisponivel):
        return JSONResponse(
            status_code=503,
            content={"codigo": "sptrans_indisponivel",
                     "mensagem": "SPTrans indisponível no momento. Tente novamente.",
                     "tentar_novamente": True}
        )

    @app.exception_handler(ErroSPTrans)
    async def _erro_sptrans(_: Request, __: ErroSPTrans):
        return JSONResponse(
            status_code=502,
            content={"codigo": "erro_sptrans",
                     "mensagem": "Erro ao consultar a SPTrans.",
                     "tentar_novamente": True}
        )

    return app


app = criar_app()
