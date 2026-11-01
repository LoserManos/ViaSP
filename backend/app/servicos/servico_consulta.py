"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel

from .cliente_sptrans import ClienteSPTrans


def _normalizar_texto(texto: str) -> str:
    """Remove acentos e converte para minúsculas para facilitar a busca."""
    if not texto:
        return ""
    texto_sem_acento = unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII")
    return texto_sem_acento.lower()

class ServicoConsulta:
    def __init__(self, cliente: ClienteSPTrans) -> None:
        self._cliente = cliente

    async def buscar_linhas(self, parada: Parada, termo: str = "") -> list[Linha]:
        """Linhas atendidas pela parada (US01), filtradas por termo (US02)."""
        # 1. Pede ao cliente para buscar todas as linhas da parada (conforme ADR-001)
        linhas = await self._cliente.buscar_linhas_da_parada(parada.codigo)

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

        return linhas_filtradas

    async def consultar_paradas(self, linha: Linha, limite_numero_paradas: int = 5) -> list[Parada]:
        """Itinerário simplificado: paradas da linha (US03)."""
        lista_paradas_completa = await self._cliente.buscar_paradas(linha.codigo)

        if not lista_paradas_completa:
            return []

        total_paradas = len(lista_paradas_completa)

        if total_paradas <= limite_numero_paradas:
            return lista_paradas_completa

        passo = (total_paradas - 1) / (limite_numero_paradas - 1)
        lista_paradas_filtrada = []
        for i in range(limite_numero_paradas):
            indice_exato = round(i * passo)
            lista_paradas_filtrada.append(lista_paradas_completa[indice_exato])

        return lista_paradas_filtrada

    async def consultar_previsoes(
        self, parada: Parada, linha: Linha
    ) -> ConsultaPrevisao:
        """Previsões de chegada (US06), com horário de referência (US07)."""
        try:
            # O cliente já sabe buscar as previsões e lidar com a rede
            consulta = await self._cliente.obter_previsoes(parada.codigo, linha.codigo)

        except SPTransIndisponivel:
            return self._criar_consulta_falha(
                parada, linha, "O sistema de previsão está indisponível no momento. Tente novamente em instantes.")
        except (ErroAutenticacaoSPTrans, ErroSPTrans):
            return self._criar_consulta_falha(
                parada, linha, "Não foi possível obter a previsão devido a um erro de comunicação.")
        except Exception:
            return self._criar_consulta_falha(
                parada, linha, "Ocorreu um erro inesperado ao buscar a previsão.")

        # Se a consulta foi bem-sucedida e tem veículos, ordena pelo tempo de espera (ISS-09.1)
        if consulta.estado == EstadoConsulta.SUCESSO and consulta.previsoes:
            # Usa o horario_referencia (da API) ou o horario_consulta como base para o cálculo
            referencia = consulta.horario_referencia or consulta.horario_consulta
            consulta.previsoes.sort(key=lambda p: p.calcular_tempo_de_espera(referencia))

        return consulta

    def _criar_consulta_falha(self, parada: Parada, linha: Linha, mensagem: str) -> ConsultaPrevisao:
        """Método auxiliar para padronizar a criação de uma consulta com falha."""

        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime.now(ZoneInfo("America/Sao_Paulo")),
            estado=EstadoConsulta.FALHA,
            mensagem_erro=mensagem
        )
