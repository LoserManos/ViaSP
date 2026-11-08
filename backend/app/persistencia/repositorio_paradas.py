"""Paradas da cidade importadas do GTFS da SPTrans.

O GTFS (General Transit Feed Specification) é publicado pela SPTrans na área do
desenvolvedor. Daqui só usamos o `stops.txt`: código, nome, referência e
coordenadas de cada parada, que a API Olho Vivo nem sempre tem.
"""

import csv
import io
import zipfile
from collections.abc import Iterator
from pathlib import Path

from app.dominio import Parada

from .banco import conectar

_MARCADOR_REFERENCIA = "Ref.:"


def _linhas_stops(caminho: Path) -> Iterator[dict[str, str]]:
    """Lê o stops.txt de uma pasta, de um .zip do GTFS ou do próprio arquivo."""
    yield from _linhas_arquivo_gtfs(caminho, "stops.txt")


def _linhas_arquivo_gtfs(caminho: Path, nome_arquivo: str) -> Iterator[dict[str, str]]:
    """Lê qualquer arquivo do GTFS de uma pasta, de um .zip ou do próprio arquivo."""
    if caminho.is_dir():
        caminho_arq = caminho / nome_arquivo
        if not caminho_arq.exists():
            return
        with caminho_arq.open(encoding="utf-8-sig", newline="") as arquivo:
            yield from csv.DictReader(arquivo)
        return
    if caminho.suffix == ".zip":
        with zipfile.ZipFile(caminho) as arquivo_zip:
            if nome_arquivo in arquivo_zip.namelist():
                with arquivo_zip.open(nome_arquivo) as bruto:
                    yield from csv.DictReader(io.TextIOWrapper(bruto, encoding="utf-8-sig"))
        return
    if caminho.name == nome_arquivo and caminho.exists():
        with caminho.open(encoding="utf-8-sig", newline="") as arquivo:
            yield from csv.DictReader(arquivo)


def _converter(linha: dict[str, str]) -> tuple[int, str, str, float, float] | None:
    try:
        codigo = int(linha["stop_id"])
        latitude = float(linha["stop_lat"])
        longitude = float(linha["stop_lon"])
    except (KeyError, TypeError, ValueError):
        return None
    # stop_desc vem como "Av. X, 540 Ref.: R Y/ R Z" ou só "Ref.: R Y/ R Z"
    partes = (linha.get("stop_desc") or "").split(_MARCADOR_REFERENCIA)
    endereco = " · ".join(p.strip() for p in partes if p.strip())
    return codigo, (linha.get("stop_name") or "").strip(), endereco, latitude, longitude


def _para_parada(registro) -> Parada:
    return Parada(
        codigo=registro["codigo"],
        nome=registro["nome"],
        endereco=registro["endereco"],
        latitude=registro["latitude"],
        longitude=registro["longitude"],
    )


class RepositorioParadas:
    def __init__(self, caminho_banco: str) -> None:
        self._caminho = caminho_banco

    def importar_gtfs(self, caminho: str | Path) -> int:
        """Substitui as paradas e itinerários gravados pelos do GTFS e devolve quantas paradas foram importadas."""
        caminho = Path(caminho)
        if not caminho.exists():
            raise FileNotFoundError(caminho)
        registros = [r for r in map(_converter, _linhas_stops(caminho)) if r is not None]

        trips = []
        for r in _linhas_arquivo_gtfs(caminho, "trips.txt"):
            dir_id = 0
            if r.get("direction_id") is not None and str(r["direction_id"]).isdigit():
                dir_id = int(r["direction_id"])
            trips.append((r["trip_id"], r["route_id"], dir_id, r.get("trip_headsign", "")))

        stop_times = []
        for r in _linhas_arquivo_gtfs(caminho, "stop_times.txt"):
            try:
                stop_times.append((r["trip_id"], int(r["stop_id"]), int(r["stop_sequence"])))
            except (ValueError, KeyError, TypeError):
                continue

        with conectar(self._caminho) as conexao:
            conexao.execute("DELETE FROM parada_gtfs")
            conexao.executemany(
                "INSERT OR REPLACE INTO parada_gtfs (codigo, nome, endereco, latitude, longitude) "
                "VALUES (?, ?, ?, ?, ?)",
                registros,
            )
            if trips:
                conexao.execute("DELETE FROM viagem_gtfs")
                conexao.executemany(
                    "INSERT OR REPLACE INTO viagem_gtfs (trip_id, route_id, direction_id, trip_headsign) "
                    "VALUES (?, ?, ?, ?)",
                    trips,
                )
            if stop_times:
                conexao.execute("DELETE FROM itinerario_gtfs")
                conexao.executemany(
                    "INSERT OR REPLACE INTO itinerario_gtfs (trip_id, stop_id, stop_sequence) VALUES (?, ?, ?)",
                    stop_times,
                )

        return len(registros)

    def contar(self) -> int:
        with conectar(self._caminho) as conexao:
            return conexao.execute("SELECT COUNT(*) FROM parada_gtfs").fetchone()[0]

    def contar_viagens(self) -> int:
        with conectar(self._caminho) as conexao:
            try:
                return conexao.execute("SELECT COUNT(*) FROM viagem_gtfs").fetchone()[0]
            except Exception:
                return 0

    def buscar_itinerario_linha(self, numero_linha: str, destino: str = "", sentido: int | None = None) -> list[Parada]:
        """Recupera a sequência ordenada de todas as paradas do itinerário da linha no GTFS."""
        numero_limpo = numero_linha.strip()
        if not numero_limpo:
            return []

        with conectar(self._caminho) as conexao:
            trips = conexao.execute(
                "SELECT trip_id, direction_id, trip_headsign FROM viagem_gtfs WHERE route_id = ?",
                (numero_limpo,),
            ).fetchall()

            if not trips:
                trips = conexao.execute(
                    "SELECT trip_id, direction_id, trip_headsign FROM viagem_gtfs WHERE route_id LIKE ?",
                    (f"{numero_limpo}%",),
                ).fetchall()

            if not trips:
                return []

            trip_escolhida = None
            if destino:
                dest_lower = destino.strip().lower()
                for t in trips:
                    headsign = (t["trip_headsign"] or "").lower()
                    if dest_lower in headsign or headsign in dest_lower:
                        trip_escolhida = t["trip_id"]
                        break

            if not trip_escolhida and sentido is not None:
                dir_id = 0 if sentido == 1 else 1
                for t in trips:
                    if t["direction_id"] == dir_id:
                        trip_escolhida = t["trip_id"]
                        break

            if not trip_escolhida:
                trip_escolhida = trips[0]["trip_id"]

            registros = conexao.execute(
                """
                SELECT p.codigo, p.nome, p.endereco, p.latitude, p.longitude
                FROM itinerario_gtfs i
                JOIN parada_gtfs p ON p.codigo = i.stop_id
                WHERE i.trip_id = ?
                ORDER BY i.stop_sequence ASC
                """,
                (trip_escolhida,),
            ).fetchall()

            return [_para_parada(r) for r in registros]

    def buscar(self, codigo: int) -> Parada | None:
        with conectar(self._caminho) as conexao:
            registro = conexao.execute("SELECT * FROM parada_gtfs WHERE codigo = ?", (codigo,)).fetchone()
        return _para_parada(registro) if registro else None

    def buscar_linhas_da_parada(self, codigo_parada: int) -> list[dict]:
        """Recupera todas as rotas/linhas que atendem a parada no GTFS."""
        with conectar(self._caminho) as conexao:
            registros = conexao.execute(
                """
                SELECT DISTINCT v.route_id, v.trip_headsign, v.direction_id
                FROM itinerario_gtfs i
                JOIN viagem_gtfs v ON i.trip_id = v.trip_id
                WHERE i.stop_id = ?
                ORDER BY v.route_id, v.direction_id
                """,
                (codigo_parada,),
            ).fetchall()

        return [
            {
                "numero": r["route_id"],
                "destino": r["trip_headsign"],
                "sentido": 1 if r["direction_id"] == 0 else 2,
            }
            for r in registros
        ]

    def buscar_na_area(
        self, lat_min: float, lat_max: float, lon_min: float, lon_max: float, limite: int
    ) -> list[Parada]:
        """Paradas dentro do retângulo, no máximo `limite` (para o mapa do modo dev)."""
        with conectar(self._caminho) as conexao:
            registros = conexao.execute(
                "SELECT * FROM parada_gtfs WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? "
                "ORDER BY codigo LIMIT ?",
                (lat_min, lat_max, lon_min, lon_max, limite),
            ).fetchall()
        return [_para_parada(r) for r in registros]
