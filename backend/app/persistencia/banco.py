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

-- Viagens e Itinerários importados do GTFS da SPTrans (trips.txt e stop_times.txt)
CREATE TABLE IF NOT EXISTS viagem_gtfs (
    trip_id       TEXT PRIMARY KEY,
    route_id      TEXT NOT NULL,
    direction_id  INTEGER,
    trip_headsign TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_viagem_gtfs_route ON viagem_gtfs (route_id);

CREATE TABLE IF NOT EXISTS itinerario_gtfs (
    trip_id       TEXT NOT NULL,
    stop_id       INTEGER NOT NULL,
    stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX IF NOT EXISTS idx_itinerario_gtfs_trip ON itinerario_gtfs (trip_id);
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
