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

-- Paradas da cidade importadas do GTFS da SPTrans (stops.txt)
CREATE TABLE IF NOT EXISTS parada_gtfs (
    codigo     INTEGER PRIMARY KEY,
    nome       TEXT    NOT NULL,
    endereco   TEXT    NOT NULL DEFAULT '',
    latitude   REAL    NOT NULL,
    longitude  REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parada_gtfs_posicao ON parada_gtfs (latitude, longitude);
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
