"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
from app.dominio import ConsultaPrevisao, Linha, Parada

from .cliente_sptrans import ClienteSPTrans


class ServicoConsulta:
    def __init__(self, cliente: ClienteSPTrans) -> None:
        self._cliente = cliente

    async def buscar_linhas(self, parada: Parada, termo: str = "") -> list[Linha]:
        """Linhas atendidas pela parada (US01), filtradas por termo (US02)."""
        raise NotImplementedError

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
        """Previsões de chegada (US06), com horário de referência (US07).

        Falhas devem virar ConsultaPrevisao com estado FALHA ou exceção
        tratada, nunca estourar um erro opaco para o totem (US08).
        """
        raise NotImplementedError
