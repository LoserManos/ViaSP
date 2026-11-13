import logging
import re
import sqlite3

from app.config import get_settings
from app.dominio import ConsultaPrevisao

from .banco import conectar

logger = logging.getLogger(__name__)

_PADRAO_TOKEN_QUERY = re.compile(r"(token=)[^&\"\s]+", re.IGNORECASE)


def _sanitizar_erro(erro: str | None) -> str | None:
    """Garante que o token da SPTrans nunca seja gravado na tabela de logs."""
    if not erro:
        return None
    texto = _PADRAO_TOKEN_QUERY.sub(r"\1***", erro)
    token_configurado = get_settings().sptrans_token.strip()
    if token_configurado and token_configurado in texto:
        texto = texto.replace(token_configurado, "***")
    return texto


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
        codigo_parada = consulta.parada.codigo if consulta.parada is not None else None
        codigo_linha = consulta.linha.codigo if consulta.linha is not None else None
        estado = consulta.estado.value if hasattr(consulta.estado, "value") else str(consulta.estado)
        latencia_final = latencia_ms if latencia_ms is not None else consulta.latencia_ms
        erro_bruto = erro if erro is not None else (consulta.mensagem_erro or None)
        erro_final = _sanitizar_erro(erro_bruto)

        try:
            with conectar(self._caminho) as conexao:
                conexao.execute(
                    """
                    INSERT INTO log_consulta (
                        totem_id,
                        codigo_parada,
                        codigo_linha,
                        estado,
                        latencia_ms,
                        erro
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        totem_id,
                        codigo_parada,
                        codigo_linha,
                        estado,
                        latencia_final,
                        erro_final,
                    ),
                )
        except (sqlite3.Error, OSError) as exc:
            logger.warning("Não foi possível gravar log de consulta no SQLite: %s", exc)
