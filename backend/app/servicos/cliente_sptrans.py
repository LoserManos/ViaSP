"""Cliente HTTP da API Olho Vivo (SPTrans).

Responsável por autenticação e comunicação com a API externa. O token vem
de variável de ambiente e nunca deve ser exposto ao frontend nem vazado em logs.

Endpoints previstos (ver docs/entregas/entrega-1.md):
  POST /Login/Autenticar?token=...
  GET  /Linha/Buscar?termosBusca=...
  GET  /Parada/BuscarParadasPorLinha?codigoLinha=...
  GET  /Previsao?codigoParada=...&codigoLinha=...
"""

import logging
import re

import httpx

from app.dominio import ConsultaPrevisao, Linha, Parada
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel

logger = logging.getLogger(__name__)


class MascararTokenLogFilter(logging.Filter):
    """Filtro de logging que mascara parâmetros 'token=...' em URLs registradas nos logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args:
            novos_args = []
            for arg in record.args:
                texto = str(arg)
                if "token=" in texto:
                    novos_args.append(re.sub(r"(token=)[^&\"\s]+", r"\1***", texto))
                else:
                    novos_args.append(arg)
            record.args = tuple(novos_args)
        if isinstance(record.msg, str) and "token=" in record.msg:
            record.msg = re.sub(r"(token=)[^&\"\s]+", r"\1***", record.msg)
        return True


def _configurar_mascaramento_logs() -> None:
    httpx_logger = logging.getLogger("httpx")
    if not any(isinstance(f, MascararTokenLogFilter) for f in httpx_logger.filters):
        httpx_logger.addFilter(MascararTokenLogFilter())


_configurar_mascaramento_logs()


def _mascarar_token(token: str) -> str:
    """Mascara o token para exibição segura em logs."""
    if not token:
        return "<vazio>"
    if len(token) <= 8:
        return "***"
    return f"{token[:4]}...{token[-4:]}"


class ClienteSPTrans:
    def __init__(
        self,
        token: str,
        base_url: str,
        timeout: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._token = token.strip() if token else ""
        self._base_url = base_url
        self._timeout = timeout
        self._http = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            transport=transport,
        )
        self._autenticado = False

    async def fechar(self) -> None:
        await self._http.aclose()

    async def autenticar(self) -> None:
        """Autentica na API Olho Vivo e mantém o cookie de sessão no cliente HTTP."""
        if not self._token:
            logger.error("Tentativa de autenticação com token vazio ou não configurado.")
            raise ErroAutenticacaoSPTrans("Token da SPTrans não configurado ou vazio.")

        logger.info("Autenticando na SPTrans com token %s...", _mascarar_token(self._token))
        try:
            # content=b"" garante o envio de Content-Length: 0, evitando HTTP 411 Length Required
            resposta = await self._http.post(
                "/Login/Autenticar",
                params={"token": self._token},
                content=b"",
            )
        except httpx.TimeoutException as exc:
            logger.error("Timeout na autenticação com SPTrans: %s", exc)
            raise SPTransIndisponivel("Timeout ao autenticar com a SPTrans.") from exc
        except httpx.NetworkError as exc:
            logger.error("Falha de rede na autenticação com SPTrans: %s", exc)
            raise SPTransIndisponivel("Falha de conexão ao autenticar com a SPTrans.") from exc

        if resposta.status_code >= 500:
            logger.error("SPTrans retornou erro 5xx na autenticação: %s", resposta.status_code)
            raise SPTransIndisponivel(f"SPTrans indisponível na autenticação (HTTP {resposta.status_code}).")

        if resposta.status_code == 401:
            logger.warning("SPTrans rejeitou o token com HTTP 401.")
            raise ErroAutenticacaoSPTrans("Falha de autenticação com a SPTrans: token inválido ou não autorizado.")

        if resposta.status_code != 200:
            logger.error("Erro inesperado na autenticação: HTTP %s", resposta.status_code)
            raise ErroSPTrans(f"Erro na autenticação com a SPTrans (HTTP {resposta.status_code}).")

        # A API Olho Vivo retorna 200 com corpo `true` quando autenticado com sucesso, e `false` caso contrário
        conteudo = resposta.text.strip().lower()
        if conteudo != "true":
            logger.warning("Autenticação na SPTrans recusada (corpo retornado: %s).", conteudo)
            raise ErroAutenticacaoSPTrans("Falha de autenticação com a SPTrans: token recusado.")

        self._autenticado = True
        logger.info("Autenticação na SPTrans realizada com sucesso.")

    async def _requisitar(
        self,
        metodo: str,
        endpoint: str,
        retry_auth: bool = True,
        **kwargs,
    ) -> httpx.Response:
        """Executa uma requisição HTTP garantindo autenticação e reautenticando se a sessão expirou."""
        if not self._autenticado:
            await self.autenticar()

        try:
            resposta = await self._http.request(metodo, endpoint, **kwargs)
        except httpx.TimeoutException as exc:
            logger.error("Timeout na requisição %s %s: %s", metodo, endpoint, exc)
            raise SPTransIndisponivel("Timeout ao comunicar com a SPTrans.") from exc
        except httpx.NetworkError as exc:
            logger.error("Falha de rede na requisição %s %s: %s", metodo, endpoint, exc)
            raise SPTransIndisponivel("Falha de conexão com a SPTrans.") from exc

        # Identificar sessão expirada ou não autorizada
        eh_sessao_invalida = resposta.status_code == 401 or (
            resposta.status_code == 200 and "Authorization has been denied" in resposta.text
        )

        if eh_sessao_invalida:
            if retry_auth:
                logger.warning(
                    "Sessão com SPTrans expirada ao acessar %s. Reautenticando...",
                    endpoint,
                )
                self._autenticado = False
                await self.autenticar()
                return await self._requisitar(metodo, endpoint, retry_auth=False, **kwargs)
            logger.error("Sessão SPTrans expirada mesmo após tentativa de reautenticação.")
            raise ErroAutenticacaoSPTrans("Sessão da SPTrans expirada e reautenticação falhou.")

        if resposta.status_code >= 500:
            logger.error("SPTrans retornou erro 5xx (%s) em %s %s", resposta.status_code, metodo, endpoint)
            raise SPTransIndisponivel(f"SPTrans indisponível (HTTP {resposta.status_code}).")

        if resposta.status_code >= 400:
            logger.error("SPTrans retornou erro 4xx (%s) em %s %s", resposta.status_code, metodo, endpoint)
            raise ErroSPTrans(f"Erro na comunicação com a SPTrans (HTTP {resposta.status_code}).")

        return resposta

    async def buscar_linhas(self, termo: str) -> list[Linha]:
        raise NotImplementedError

    async def buscar_paradas(self, codigo_linha: int) -> list[Parada]:
        raise NotImplementedError

    async def obter_previsoes(self, codigo_parada: int, codigo_linha: int) -> ConsultaPrevisao:
        raise NotImplementedError
