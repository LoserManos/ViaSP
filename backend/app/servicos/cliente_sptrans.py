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
from datetime import datetime
from typing import Any

import httpx

from app.dominio import (
    ConsultaPrevisao,
    EstadoConsulta,
    Linha,
    Parada,
    PrevisaoChegada,
    Veiculo,
)
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


def _para_float(valor: Any, padrao: float = 0.0) -> float:
    if valor is None or isinstance(valor, bool):
        return padrao
    try:
        return float(valor)
    except (TypeError, ValueError):
        return padrao


def _para_int(valor: Any, padrao: int | None = None) -> int | None:
    if valor is None or isinstance(valor, bool):
        return padrao
    try:
        return int(valor)
    except (TypeError, ValueError):
        return padrao


def _converter_linha(dados: Any) -> Linha | None:
    """Converte um dicionário JSON da SPTrans em objeto de domínio `Linha`.

    Suporta tanto o formato de `/Linha/Buscar` (`cl`, `lt`, `tl`, `sl`, `tp`, `ts`)
    quanto o formato resumido de `/Previsao` (`cl`, `c`, `sl`, `lt0`, `lt1`).
    Na convenção da SPTrans, `tp`/`lt0` informa o letreiro (destino) quando `sl == 1`
    e `ts`/`lt1` informa o letreiro (destino) quando `sl == 2`.
    """
    if not isinstance(dados, dict):
        return None

    codigo = _para_int(dados.get("cl"))
    if codigo is None:
        return None

    lt = dados.get("lt")
    tl = dados.get("tl")
    if lt is not None and str(lt).strip() != "":
        lt_limpo = str(lt).strip()
        if tl is not None and not isinstance(tl, bool) and str(tl).strip() != "":
            numero = f"{lt_limpo}-{str(tl).strip()}"
        else:
            numero = lt_limpo
    else:
        c = dados.get("c")
        numero = str(c).strip() if c is not None else ""

    sentido = _para_int(dados.get("sl"), padrao=1) or 1

    raw_principal = dados.get("tp") if dados.get("tp") is not None else dados.get("lt0")
    raw_secundario = dados.get("ts") if dados.get("ts") is not None else dados.get("lt1")
    letreiro_principal = str(raw_principal).strip() if raw_principal is not None else ""
    letreiro_secundario = str(raw_secundario).strip() if raw_secundario is not None else ""

    if sentido == 2:
        origem = letreiro_principal
        destino = letreiro_secundario
    else:
        origem = letreiro_secundario
        destino = letreiro_principal

    return Linha(
        codigo=codigo,
        numero=numero,
        sentido=sentido,
        origem=origem,
        destino=destino,
    )


def _converter_parada(dados: Any) -> Parada | None:
    """Converte um dicionário JSON da SPTrans em objeto de domínio `Parada`."""
    if not isinstance(dados, dict):
        return None

    codigo = _para_int(dados.get("cp"))
    if codigo is None:
        return None

    np = dados.get("np")
    ed = dados.get("ed")
    nome = str(np).strip() if np is not None else ""
    endereco = str(ed).strip() if ed is not None else ""
    latitude = _para_float(dados.get("py"), padrao=0.0)
    longitude = _para_float(dados.get("px"), padrao=0.0)

    return Parada(
        codigo=codigo,
        nome=nome,
        endereco=endereco,
        latitude=latitude,
        longitude=longitude,
    )


def _converter_previsao_chegada(dados: Any) -> PrevisaoChegada | None:
    """Converte um dicionário de veículo (`vs`) da SPTrans em `PrevisaoChegada`."""
    if not isinstance(dados, dict):
        return None

    horario_bruto = dados.get("t")
    if horario_bruto is None or isinstance(horario_bruto, bool):
        return None
    horario_previsto = str(horario_bruto).strip()
    if not horario_previsto:
        return None

    prefixo_bruto = dados.get("p")
    if prefixo_bruto is None or isinstance(prefixo_bruto, bool):
        prefixo = ""
    else:
        prefixo = str(prefixo_bruto).strip()

    return PrevisaoChegada(
        horario_previsto=horario_previsto,
        veiculo=Veiculo(prefixo=prefixo),
    )


def _extrair_json(resposta: httpx.Response) -> Any:
    """Extrai o JSON da resposta HTTP tratando corpo vazio sem levantar exceção."""
    if not resposta.content or not resposta.text.strip():
        return None
    try:
        return resposta.json()
    except ValueError as exc:
        raise ErroSPTrans("Resposta inválida (JSON malformado) recebida da SPTrans.") from exc


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
        """Consulta as previsões de chegada de uma linha em uma parada (`GET /Previsao`)."""
        resposta = await self._requisitar(
            "GET",
            "/Previsao",
            params={"codigoParada": codigo_parada, "codigoLinha": codigo_linha},
        )
        horario_consulta = datetime.now()
        dados = _extrair_json(resposta)

        parada_padrao = Parada(codigo=codigo_parada)
        linha_padrao = Linha(codigo=codigo_linha, numero="", sentido=1)

        if not isinstance(dados, dict):
            return ConsultaPrevisao(
                parada=parada_padrao,
                linha=linha_padrao,
                horario_consulta=horario_consulta,
                horario_referencia="",
                estado=EstadoConsulta.SEM_PREVISAO,
                previsoes=[],
            )

        hr = dados.get("hr")
        horario_referencia = str(hr).strip() if hr is not None and not isinstance(hr, bool) else ""

        dados_parada = dados.get("p")
        if not isinstance(dados_parada, dict):
            return ConsultaPrevisao(
                parada=parada_padrao,
                linha=linha_padrao,
                horario_consulta=horario_consulta,
                horario_referencia=horario_referencia,
                estado=EstadoConsulta.SEM_PREVISAO,
                previsoes=[],
            )

        dados_parada_fallback = {
            **dados_parada,
            "cp": dados_parada.get("cp") if _para_int(dados_parada.get("cp")) is not None else codigo_parada,
        }
        parada = _converter_parada(dados_parada_fallback) or parada_padrao

        lista_linhas = dados_parada.get("l")
        dados_linha_escolhida: dict[str, Any] | None = None
        if isinstance(lista_linhas, list):
            for item_linha in lista_linhas:
                if isinstance(item_linha, dict) and _para_int(item_linha.get("cl")) == codigo_linha:
                    dados_linha_escolhida = item_linha
                    break
            if (
                dados_linha_escolhida is None
                and len(lista_linhas) == 1
                and isinstance(lista_linhas[0], dict)
                and _para_int(lista_linhas[0].get("cl")) is None
            ):
                dados_linha_escolhida = lista_linhas[0]

        if dados_linha_escolhida is None:
            return ConsultaPrevisao(
                parada=parada,
                linha=linha_padrao,
                horario_consulta=horario_consulta,
                horario_referencia=horario_referencia,
                estado=EstadoConsulta.SEM_PREVISAO,
                previsoes=[],
            )

        dados_linha_fallback = {
            **dados_linha_escolhida,
            "cl": (
                dados_linha_escolhida.get("cl")
                if _para_int(dados_linha_escolhida.get("cl")) is not None
                else codigo_linha
            ),
        }
        linha = _converter_linha(dados_linha_fallback) or linha_padrao

        lista_veiculos = dados_linha_escolhida.get("vs")
        previsoes: list[PrevisaoChegada] = []
        if isinstance(lista_veiculos, list):
            for item_veiculo in lista_veiculos:
                previsao = _converter_previsao_chegada(item_veiculo)
                if previsao is not None:
                    previsoes.append(previsao)

        estado = EstadoConsulta.SUCESSO if previsoes else EstadoConsulta.SEM_PREVISAO

        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=horario_consulta,
            horario_referencia=horario_referencia,
            estado=estado,
            previsoes=previsoes,
        )
