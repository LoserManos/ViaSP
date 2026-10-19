from app.dominio import ConsultaPrevisao


class RepositorioLogs:
    def __init__(self, caminho_banco: str) -> None:
        self._caminho = caminho_banco

    def registrar_consulta(
        self,
        totem_id: str,
        consulta: ConsultaPrevisao,
        latencia_ms: int | None = None,
        erro: str | None = None,
    ) -> None:
        """Grava log da consulta (chamar via BackgroundTasks)."""
        raise NotImplementedError
