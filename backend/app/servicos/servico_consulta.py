"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
from app.dominio import ConsultaPrevisao, Linha, Parada

from .cliente_sptrans import ClienteSPTrans


class ServicoConsulta:
    def __init__(self, cliente: ClienteSPTrans) -> None:
        self._cliente = cliente

    async def buscar_linhas(self, parada: Parada, termo: str = "") -> list[Linha]:
        """Linhas atendidas pela parada (US01), filtradas por termo (US02)."""
        raise NotImplementedError

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
