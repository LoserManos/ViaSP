"""SQLite local: configuração do totem e logs de uso (assíncronos via BackgroundTasks)."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS log_consulta (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    totem_id       TEXT    NOT NULL,
    codigo_parada  INTEGER,
    codigo_linha   INTEGER,
    estado         TEXT    NOT NULL,   -- sucesso | sem_previsao | falha
    latencia_ms    INTEGER,
    erro           TEXT,
    criado_em      TEXT    NOT NULL DEFAULT (datetime('now'))
);
"""


@contextmanager
def conectar(caminho: str) -> Iterator[sqlite3.Connection]:
    conexao = sqlite3.connect(caminho)
    conexao.row_factory = sqlite3.Row
    try:
        yield conexao
        conexao.commit()
    finally:
        conexao.close()


def inicializar_banco(caminho: str) -> None:
    Path(caminho).parent.mkdir(parents=True, exist_ok=True)
    with conectar(caminho) as conexao:
        conexao.executescript(SCHEMA)
