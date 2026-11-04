"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
import asyncio
import time
import unicodedata
from collections.abc import Callable, Iterable
from dataclasses import replace
from datetime import datetime
from typing import TypeVar
from zoneinfo import ZoneInfo

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel

from .cliente_sptrans import ClienteSPTrans

# As linhas do ponto vêm de /Previsao/Parada (ADR-001) e mudam conforme os ônibus circulam
TTL_LINHAS_DO_PONTO_SEGUNDOS = 60.0
# O itinerário (paradas da linha) é um dado quase estático
TTL_PARADAS_DA_LINHA_SEGUNDOS = 3600.0
# As previsões de chegada mudam rápido, mas o cache curto absorve acessos simultâneos
TTL_PREVISOES_SEGUNDOS = 15.0

_T = TypeVar("_T")


class ListaCacheada(list[_T]):
    """Lista compatível com `list` que indica se os itens vieram de cache expirado (`desatualizado`)."""

    def __init__(self, itens: Iterable[_T] = (), *, desatualizado: bool = False) -> None:
        super().__init__(itens)
        self.desatualizado = desatualizado


def _normalizar_texto(texto: str) -> str:
    """Remove acentos e converte para minúsculas para facilitar a busca."""
    if not texto:
        return ""
    texto_sem_acento = unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII")
    return texto_sem_acento.lower()


class ServicoConsulta:
    def __init__(
        self,
        cliente: ClienteSPTrans,
        relogio: Callable[[], float] = time.monotonic,
        *,
        ttl_linhas_segundos: float = TTL_LINHAS_DO_PONTO_SEGUNDOS,
        ttl_paradas_segundos: float = TTL_PARADAS_DA_LINHA_SEGUNDOS,
        ttl_previsoes_segundos: float = TTL_PREVISOES_SEGUNDOS,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._ttl_linhas_segundos = ttl_linhas_segundos
        self._ttl_paradas_segundos = ttl_paradas_segundos
        self._ttl_previsoes_segundos = ttl_previsoes_segundos

        self._cache_linhas: dict[int, tuple[float, list[Linha]]] = {}
        self._cache_paradas: dict[int, tuple[float, list[Parada]]] = {}
        self._cache_previsoes: dict[tuple[int, int], tuple[float, ConsultaPrevisao]] = {}

        self._trava_linhas = asyncio.Lock()
        self._trava_paradas = asyncio.Lock()
        self._trava_previsoes = asyncio.Lock()

    async def _linhas_do_ponto(self, parada: Parada) -> ListaCacheada[Linha]:
        """Linhas do ponto com cache em memória e fallback em caso de falha.

        Usa `/Previsao/Parada` (Opção (a) do ADR-001): só as linhas com ônibus previsto.
        A trava faz requisições simultâneas compartilharem uma única chamada à SPTrans.
        """
        async with self._trava_linhas:
            em_cache = self._cache_linhas.get(parada.codigo)
            if em_cache is not None and self._relogio() - em_cache[0] < self._ttl_linhas_segundos:
                return ListaCacheada(em_cache[1], desatualizado=False)

            try:
                linhas = list(await self._cliente.buscar_linhas_com_previsao(parada.codigo))
            except Exception:
                if em_cache is not None:
                    return ListaCacheada(em_cache[1], desatualizado=True)
                raise

            self._cache_linhas[parada.codigo] = (self._relogio(), linhas)
            return ListaCacheada(linhas, desatualizado=False)

    async def buscar_linhas(self, parada: Parada, termo: str = "") -> ListaCacheada[Linha]:
        """Linhas atendidas pela parada (US01), filtradas por termo (US02)."""
        # 1. Linhas do ponto (ver _linhas_do_ponto e ADR-001)
        linhas = await self._linhas_do_ponto(parada)

        # 2. Se não houver termo, retorna todas
        termo_limpo = termo.strip()
        if not termo_limpo:
            return linhas

        # 3. Se houver termo, filtra (normalizando acentos e maiúsculas/minúsculas)
        termo_normalizado = _normalizar_texto(termo_limpo)
        linhas_filtradas: list[Linha] = []

        for linha in linhas:
            # Concatena número, origem e destino para buscar em qualquer um deles
            campos_busca = f"{linha.numero} {linha.origem or ''} {linha.destino or ''}"
            if termo_normalizado in _normalizar_texto(campos_busca):
                linhas_filtradas.append(linha)

        return ListaCacheada(linhas_filtradas, desatualizado=linhas.desatualizado)

    async def _paradas_da_linha(self, codigo_linha: int) -> ListaCacheada[Parada]:
        """Paradas da linha com cache de TTL longo e fallback em caso de falha."""
        async with self._trava_paradas:
            em_cache = self._cache_paradas.get(codigo_linha)
            if em_cache is not None and self._relogio() - em_cache[0] < self._ttl_paradas_segundos:
                return ListaCacheada(em_cache[1], desatualizado=False)

            try:
                paradas = list(await self._cliente.buscar_paradas(codigo_linha))
            except Exception:
                if em_cache is not None:
                    return ListaCacheada(em_cache[1], desatualizado=True)
                raise

            self._cache_paradas[codigo_linha] = (self._relogio(), paradas)
            return ListaCacheada(paradas, desatualizado=False)

    async def consultar_paradas(self, linha: Linha, limite_numero_paradas: int = 5) -> ListaCacheada[Parada]:
        """Itinerário simplificado: paradas da linha (US03)."""
        lista_paradas_completa = await self._paradas_da_linha(linha.codigo)
        desatualizado = lista_paradas_completa.desatualizado

        if not lista_paradas_completa:
            return ListaCacheada(desatualizado=desatualizado)

        total_paradas = len(lista_paradas_completa)

        if total_paradas <= limite_numero_paradas:
            return ListaCacheada(lista_paradas_completa, desatualizado=desatualizado)

        passo = (total_paradas - 1) / (limite_numero_paradas - 1)
        lista_paradas_filtrada: list[Parada] = []
        for i in range(limite_numero_paradas):
            indice_exato = round(i * passo)
            lista_paradas_filtrada.append(lista_paradas_completa[indice_exato])

        return ListaCacheada(lista_paradas_filtrada, desatualizado=desatualizado)

    async def consultar_previsoes(
        self, parada: Parada, linha: Linha
    ) -> ConsultaPrevisao:
        """Previsões de chegada (US06), com horário de referência (US07)."""
        chave = (parada.codigo, linha.codigo)
        async with self._trava_previsoes:
            em_cache = self._cache_previsoes.get(chave)
            if em_cache is not None and self._relogio() - em_cache[0] < self._ttl_previsoes_segundos:
                return self._copiar_consulta(em_cache[1], desatualizado=False)

            mensagem_falha: str | None = None
            try:
                # O cliente já sabe buscar as previsões e lidar com a rede
                consulta = await self._cliente.obter_previsoes(parada.codigo, linha.codigo)
            except SPTransIndisponivel:
                mensagem_falha = "O sistema de previsão está indisponível no momento. Tente novamente em instantes."
            except (ErroAutenticacaoSPTrans, ErroSPTrans):
                mensagem_falha = "Não foi possível obter a previsão devido a um erro de comunicação."
            except Exception:
                mensagem_falha = "Ocorreu um erro inesperado ao buscar a previsão."

            if mensagem_falha is not None:
                if em_cache is not None:
                    return self._copiar_consulta(
                        em_cache[1],
                        desatualizado=True,
                        mensagem_erro=mensagem_falha,
                    )
                return self._criar_consulta_falha(parada, linha, mensagem_falha)

            # Se a consulta foi bem-sucedida e tem veículos, ordena pelo tempo de espera (ISS-09.1)
            if consulta.estado == EstadoConsulta.SUCESSO and consulta.previsoes:
                # Usa o horario_referencia (da API) ou o horario_consulta como base para o cálculo
                referencia = consulta.horario_referencia or consulta.horario_consulta
                consulta.previsoes.sort(key=lambda p: p.calcular_tempo_de_espera(referencia))

            if consulta.foi_bem_sucedida():
                consulta_armazenada = self._copiar_consulta(consulta, desatualizado=False, mensagem_erro="")
                self._cache_previsoes[chave] = (self._relogio(), consulta_armazenada)
                return self._copiar_consulta(consulta_armazenada, desatualizado=False)

            if em_cache is not None:
                return self._copiar_consulta(
                    em_cache[1],
                    desatualizado=True,
                    mensagem_erro=consulta.mensagem_erro,
                )
            return consulta

    def _copiar_consulta(
        self,
        consulta: ConsultaPrevisao,
        *,
        desatualizado: bool,
        mensagem_erro: str | None = None,
    ) -> ConsultaPrevisao:
        return replace(
            consulta,
            previsoes=list(consulta.previsoes),
            desatualizado=desatualizado,
            mensagem_erro=consulta.mensagem_erro if mensagem_erro is None else mensagem_erro,
        )

    def _criar_consulta_falha(self, parada: Parada, linha: Linha, mensagem: str) -> ConsultaPrevisao:
        """Método auxiliar para padronizar a criação de uma consulta com falha."""

        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime.now(ZoneInfo("America/Sao_Paulo")),
            estado=EstadoConsulta.FALHA,
            mensagem_erro=mensagem,
        )
