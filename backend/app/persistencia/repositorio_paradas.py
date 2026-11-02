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
    if caminho.is_dir():
        caminho = caminho / "stops.txt"
    if caminho.suffix == ".zip":
        with zipfile.ZipFile(caminho) as arquivo_zip, arquivo_zip.open("stops.txt") as bruto:
            yield from csv.DictReader(io.TextIOWrapper(bruto, encoding="utf-8-sig"))
        return
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
        """Substitui as paradas gravadas pelas do GTFS e devolve quantas foram importadas."""
        caminho = Path(caminho)
        if not caminho.exists():
            raise FileNotFoundError(caminho)
        registros = [r for r in map(_converter, _linhas_stops(caminho)) if r is not None]
        with conectar(self._caminho) as conexao:
            conexao.execute("DELETE FROM parada_gtfs")
            conexao.executemany(
                "INSERT OR REPLACE INTO parada_gtfs (codigo, nome, endereco, latitude, longitude) "
                "VALUES (?, ?, ?, ?, ?)",
                registros,
            )
        return len(registros)

    def contar(self) -> int:
        with conectar(self._caminho) as conexao:
            return conexao.execute("SELECT COUNT(*) FROM parada_gtfs").fetchone()[0]

    def buscar(self, codigo: int) -> Parada | None:
        with conectar(self._caminho) as conexao:
            registro = conexao.execute("SELECT * FROM parada_gtfs WHERE codigo = ?", (codigo,)).fetchone()
        return _para_parada(registro) if registro else None

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
