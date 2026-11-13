"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""

import asyncio
import time
import unicodedata
from collections.abc import Callable, Iterable
from dataclasses import replace
from typing import TypeVar

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel

from .cliente_sptrans import ClienteSPTrans
from .fuso_horario import agora_sao_paulo

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
        repositorio_paradas: object | None = None,
        *,
        ttl_linhas_segundos: float = TTL_LINHAS_DO_PONTO_SEGUNDOS,
        ttl_paradas_segundos: float = TTL_PARADAS_DA_LINHA_SEGUNDOS,
        ttl_previsoes_segundos: float = TTL_PREVISOES_SEGUNDOS,
    ) -> None:
        self._cliente = cliente
        self._relogio = relogio
        self._repositorio_paradas = repositorio_paradas
        self._ttl_linhas_segundos = ttl_linhas_segundos
        self._ttl_paradas_segundos = ttl_paradas_segundos
        self._ttl_previsoes_segundos = ttl_previsoes_segundos

        self._cache_linhas: dict[int, tuple[float, list[Linha]]] = {}
        self._cache_paradas: dict[int, tuple[float, list[Parada]]] = {}
        self._cache_previsoes: dict[tuple[int, int], tuple[float, ConsultaPrevisao]] = {}
        self._cache_codigos_linhas: dict[str, list[Linha]] = {}

        self._trava_linhas = asyncio.Lock()
        self._trava_paradas = asyncio.Lock()
        self._trava_previsoes = asyncio.Lock()

    async def _obter_linha_cadastral(self, numero: str, sentido: int, destino: str) -> Linha:
        """Localiza os metadados cadastrais da linha na SPTrans, com cache em memória."""
        candidatas = self._cache_codigos_linhas.get(numero)
        if candidatas is None:
            try:
                candidatas = await self._cliente.buscar_linhas(numero)
            except Exception:
                candidatas = []
            self._cache_codigos_linhas[numero] = candidatas

        destino_norm = _normalizar_texto(destino)
        # 1. Tenta casar por sentido e destino
        for c in candidatas:
            if c.sentido == sentido and (
                destino_norm in _normalizar_texto(c.destino) or _normalizar_texto(c.destino) in destino_norm
            ):
                return c

        # 2. Tenta casar apenas por sentido
        for c in candidatas:
            if c.sentido == sentido:
                return c

        # 3. Tenta casar apenas por destino
        for c in candidatas:
            if destino_norm in _normalizar_texto(c.destino) or _normalizar_texto(c.destino) in destino_norm:
                return c

        # 4. Fallback se houver alguma candidata daquela linha
        if candidatas:
            return candidatas[0]

        # 5. Fallback sem código cadastrado
        return Linha(codigo=0, numero=numero, sentido=sentido, destino=destino)

    async def _linhas_do_ponto(self, parada: Parada) -> ListaCacheada[Linha]:
        """Linhas do ponto com cache em memória e fallback em caso de falha.

        Combina as linhas em tempo real da SPTrans com a malha completa do GTFS local.
        Linhas com ônibus a caminho têm previsão ativa; linhas sem veículos em trânsito
        permanecem na listagem com status de 'Sem previsão'.
        """
        async with self._trava_linhas:
            em_cache = self._cache_linhas.get(parada.codigo)
            if em_cache is not None and self._relogio() - em_cache[0] < self._ttl_linhas_segundos:
                return ListaCacheada(em_cache[1], desatualizado=False)

            try:
                linhas_com_previsao = list(await self._cliente.buscar_linhas_com_previsao(parada.codigo))
            except Exception:
                if em_cache is not None:
                    return ListaCacheada(em_cache[1], desatualizado=True)
                if not self._repositorio_paradas:
                    raise
                linhas_com_previsao = []

            if not self._repositorio_paradas:
                self._cache_linhas[parada.codigo] = (self._relogio(), linhas_com_previsao)
                return ListaCacheada(linhas_com_previsao, desatualizado=False)

            gtfs_linhas = self._repositorio_paradas.buscar_linhas_da_parada(parada.codigo)
            if not gtfs_linhas:
                self._cache_linhas[parada.codigo] = (self._relogio(), linhas_com_previsao)
                return ListaCacheada(linhas_com_previsao, desatualizado=False)

            mapa_ativas_por_num: dict[str, Linha] = {linha.numero: linha for linha in linhas_com_previsao}

            linhas_finais: list[Linha] = []
            chaves_inseridas: set[tuple[str, int]] = set()

            # 1. Insere primeiro todas as linhas que têm previsão ativa no momento
            for linha_prev in linhas_com_previsao:
                chave = (linha_prev.numero, linha_prev.sentido)
                if chave not in chaves_inseridas:
                    linhas_finais.append(linha_prev)
                    chaves_inseridas.add(chave)

            # 2. Identifica linhas do GTFS que não estão com previsão ativa
            faltantes = []
            for g in gtfs_linhas:
                chave = (g["numero"], g["sentido"])
                if chave not in chaves_inseridas and g["numero"] not in mapa_ativas_por_num:
                    faltantes.append(g)

            # 3. Resolve os metadados cadastrais das linhas faltantes
            if faltantes:
                linhas_resolvidas = await asyncio.gather(
                    *(self._obter_linha_cadastral(f["numero"], f["sentido"], f["destino"]) for f in faltantes)
                )
                for linha_res in linhas_resolvidas:
                    chave = (linha_res.numero, linha_res.sentido)
                    if chave not in chaves_inseridas:
                        linhas_finais.append(linha_res)
                        chaves_inseridas.add(chave)

            self._cache_linhas[parada.codigo] = (self._relogio(), linhas_finais)
            return ListaCacheada(linhas_finais, desatualizado=False)

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

    async def consultar_paradas(self, linha: Linha, limite_numero_paradas: int | None = None) -> ListaCacheada[Parada]:
        """Itinerário: paradas da linha (todas as paradas por padrão, ou simplificado se limite informado)."""
        lista_paradas_completa = await self._paradas_da_linha(linha.codigo)
        desatualizado = lista_paradas_completa.desatualizado

        if not lista_paradas_completa:
            return ListaCacheada(desatualizado=desatualizado)

        if limite_numero_paradas is None:
            return ListaCacheada(lista_paradas_completa, desatualizado=desatualizado)

        total_paradas = len(lista_paradas_completa)

        if total_paradas <= limite_numero_paradas:
            return ListaCacheada(lista_paradas_completa, desatualizado=desatualizado)

        passo = (total_paradas - 1) / (limite_numero_paradas - 1)
        lista_paradas_filtrada: list[Parada] = []
        for i in range(limite_numero_paradas):
            indice_exato = round(i * passo)
            lista_paradas_filtrada.append(lista_paradas_completa[indice_exato])

        return ListaCacheada(lista_paradas_filtrada, desatualizado=desatualizado)

    async def consultar_previsoes(self, parada: Parada, linha: Linha) -> ConsultaPrevisao:
        """Previsões de chegada (US06), com horário de referência (US07)."""
        chave = (parada.codigo, linha.codigo)
        async with self._trava_previsoes:
            em_cache = self._cache_previsoes.get(chave)
            if em_cache is not None and self._relogio() - em_cache[0] < self._ttl_previsoes_segundos:
                return self._copiar_consulta(em_cache[1], desatualizado=False)

            inicio = self._relogio()
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
            latencia_ms = max(0, round((self._relogio() - inicio) * 1000))

            if mensagem_falha is not None:
                if em_cache is not None:
                    return self._copiar_consulta(
                        em_cache[1],
                        desatualizado=True,
                        mensagem_erro=mensagem_falha,
                        latencia_ms=latencia_ms,
                    )
                return self._criar_consulta_falha(
                    parada,
                    linha,
                    mensagem_falha,
                    latencia_ms=latencia_ms,
                )

            consulta.latencia_ms = latencia_ms

            # Se a consulta foi bem-sucedida e tem veículos, ordena pelo tempo de espera (ISS-09.1)
            if consulta.estado == EstadoConsulta.SUCESSO and consulta.previsoes:
                # Usa o horario_referencia (da API) ou o horario_consulta como base para o cálculo
                referencia = consulta.horario_referencia or consulta.horario_consulta
                consulta.previsoes.sort(key=lambda p: p.calcular_tempo_de_espera(referencia))

            if consulta.foi_bem_sucedida():
                consulta_armazenada = self._copiar_consulta(
                    consulta,
                    desatualizado=False,
                    mensagem_erro="",
                    latencia_ms=latencia_ms,
                )
                self._cache_previsoes[chave] = (self._relogio(), consulta_armazenada)
                return self._copiar_consulta(consulta_armazenada, desatualizado=False)

            if em_cache is not None:
                return self._copiar_consulta(
                    em_cache[1],
                    desatualizado=True,
                    mensagem_erro=consulta.mensagem_erro,
                    latencia_ms=latencia_ms,
                )
            return consulta

    def _copiar_consulta(
        self,
        consulta: ConsultaPrevisao,
        *,
        desatualizado: bool,
        mensagem_erro: str | None = None,
        latencia_ms: int | None = None,
    ) -> ConsultaPrevisao:
        return replace(
            consulta,
            previsoes=list(consulta.previsoes),
            desatualizado=desatualizado,
            mensagem_erro=consulta.mensagem_erro if mensagem_erro is None else mensagem_erro,
            latencia_ms=consulta.latencia_ms if latencia_ms is None else latencia_ms,
        )

    def _criar_consulta_falha(
        self,
        parada: Parada,
        linha: Linha,
        mensagem: str,
        *,
        latencia_ms: int | None = None,
    ) -> ConsultaPrevisao:
        """Método auxiliar para padronizar a criação de uma consulta com falha."""

        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=agora_sao_paulo(),
            estado=EstadoConsulta.FALHA,
            mensagem_erro=mensagem,
            latencia_ms=latencia_ms,
        )
