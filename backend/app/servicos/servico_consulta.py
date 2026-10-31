"""Coordena o fluxo de consulta: parada configurada + linha/sentido."""
from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel

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
        from datetime import datetime
        from zoneinfo import ZoneInfo

        return ConsultaPrevisao(
            parada=parada,
            linha=linha,
            horario_consulta=datetime.now(ZoneInfo("America/Sao_Paulo")),
            estado=EstadoConsulta.FALHA,
            mensagem_erro=mensagem
        )
