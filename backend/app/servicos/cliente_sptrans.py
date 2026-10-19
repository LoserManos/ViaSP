"""Cliente HTTP da API Olho Vivo (SPTrans).

Responsável por autenticação e comunicação com a API externa. O token vem
de variável de ambiente e nunca deve ser exposto ao frontend.

Endpoints previstos (ver docs/entregas/entrega-1.md):
  POST /Login/Autenticar?token=...
  GET  /Linha/Buscar?termosBusca=...
  GET  /Parada/BuscarParadasPorLinha?codigoLinha=...
  GET  /Previsao?codigoParada=...&codigoLinha=...
"""
import httpx

from app.dominio import ConsultaPrevisao, Linha, Parada


class ClienteSPTrans:
    def __init__(self, token: str, base_url: str, timeout: float = 10.0) -> None:
        self._token = token
        self._http = httpx.AsyncClient(base_url=base_url, timeout=timeout)
        self._autenticado = False

    async def fechar(self) -> None:
        await self._http.aclose()

    async def autenticar(self) -> None:
        raise NotImplementedError

    async def buscar_linhas(self, termo: str) -> list[Linha]:
        raise NotImplementedError

    async def buscar_paradas(self, codigo_linha: int) -> list[Parada]:
        raise NotImplementedError

    async def obter_previsoes(
        self, codigo_parada: int, codigo_linha: int
    ) -> ConsultaPrevisao:
        raise NotImplementedError
