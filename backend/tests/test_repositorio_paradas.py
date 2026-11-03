import zipfile

import pytest

from app.persistencia import RepositorioParadas, inicializar_banco
from tests.conftest import GTFS_TESTE


@pytest.fixture
def repositorio(tmp_path):
    caminho = str(tmp_path / "x.db")
    inicializar_banco(caminho)
    return RepositorioParadas(caminho)


def test_importa_stops_de_uma_pasta(repositorio):
    assert repositorio.importar_gtfs(GTFS_TESTE) == 4
    assert repositorio.contar() == 4

    parada = repositorio.buscar(440016921)
    assert parada.nome == "Av. Paulista, 2027"
    # O marcador "Ref.:" do GTFS é removido
    assert parada.endereco == "R Padre Joao Manuel/ R Augusta -- Conjunto Nacional"
    assert repositorio.buscar(440015007).endereco == (
        "Av. Rebouças, 540 · R Doutor Ovidio Pires De Campos/ R Melo Alves"
    )
    assert (parada.latitude, parada.longitude) == (-23.558947, -46.659585)


def test_importa_stops_de_um_zip(repositorio, tmp_path):
    caminho_zip = tmp_path / "gtfs.zip"
    with zipfile.ZipFile(caminho_zip, "w") as arquivo_zip:
        arquivo_zip.write(GTFS_TESTE / "stops.txt", "stops.txt")

    assert repositorio.importar_gtfs(caminho_zip) == 4


def test_reimportar_substitui_as_paradas(repositorio):
    repositorio.importar_gtfs(GTFS_TESTE)
    repositorio.importar_gtfs(GTFS_TESTE)
    assert repositorio.contar() == 4


def test_gtfs_inexistente(repositorio, tmp_path):
    with pytest.raises(FileNotFoundError):
        repositorio.importar_gtfs(tmp_path / "nao-existe")


def test_parada_desconhecida(repositorio):
    repositorio.importar_gtfs(GTFS_TESTE)
    assert repositorio.buscar(1) is None


def test_buscar_na_area(repositorio):
    repositorio.importar_gtfs(GTFS_TESTE)

    # Retângulo em volta da Paulista e da Rebouças, sem Clínicas e Vila Madalena (metrô)
    paradas = repositorio.buscar_na_area(-23.56, -23.557, -46.668, -46.659, limite=10)
    assert [p.codigo for p in paradas] == [440015007, 440016921]

    assert len(repositorio.buscar_na_area(-24, -23, -47, -46, limite=2)) == 2
