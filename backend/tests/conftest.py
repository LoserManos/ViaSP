import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import criar_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("BANCO_CAMINHO", str(tmp_path / "teste.db"))
    monkeypatch.setenv("TOTEM_IDENTIFICADOR", "totem-teste")
    monkeypatch.setenv("PARADA_CODIGO", "123")
    get_settings.cache_clear()
    with TestClient(criar_app()) as c:
        yield c
    get_settings.cache_clear()
