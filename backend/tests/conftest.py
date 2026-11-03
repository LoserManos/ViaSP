from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import criar_app

GTFS_TESTE = Path(__file__).parent / "fixtures" / "gtfs"


@pytest.fixture
def criar_client(tmp_path, monkeypatch):
    """Sobe o app com o GTFS de teste; variáveis extras sobrescrevem as padrão."""
    clientes = []

    def _criar(**variaveis: str) -> TestClient:
        padrao = {
            "BANCO_CAMINHO": str(tmp_path / "teste.db"),
            "TOTEM_IDENTIFICADOR": "totem-teste",
            "PARADA_CODIGO": "440016921",
            "GTFS_CAMINHO": str(GTFS_TESTE),
            "MODO_DEV": "false",
            # Sem token, a subida não chama a SPTrans de verdade mesmo que exista um .env local
            "SPTRANS_TOKEN": "",
        }
        for nome, valor in {**padrao, **variaveis}.items():
            monkeypatch.setenv(nome, valor)
        get_settings.cache_clear()
        cliente = TestClient(criar_app())
        cliente.__enter__()
        clientes.append(cliente)
        return cliente

    yield _criar
    for cliente in clientes:
        cliente.__exit__(None, None, None)
    get_settings.cache_clear()


@pytest.fixture
def client(criar_client):
    return criar_client()
