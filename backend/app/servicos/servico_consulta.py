"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
import unicodedata

from app.dominio import ConsultaPrevisao, Linha, Parada

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
            campos_busca = f"{linha.numero} {linha.origem} {linha.destino}"
            if termo_normalizado in _normalizar_texto(campos_busca):
                linhas_filtradas.append(linha)

        return linhas_filtradas

    async def consultar_paradas(self, linha: Linha) -> list[Parada]:
        """Itinerário simplificado: paradas da linha (US03)."""
        raise NotImplementedError

    async def consultar_previsoes(
        self, parada: Parada, linha: Linha
    ) -> ConsultaPrevisao:
        """Previsões de chegada (US06), com horário de referência (US07).

        Falhas devem virar ConsultaPrevisao com estado FALHA ou exceção
        tratada, nunca estourar um erro opaco para o totem (US08).
        """
        raise NotImplementedError
