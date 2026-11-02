import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import criar_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("BANCO_CAMINHO", str(tmp_path / "teste.db"))
    monkeypatch.setenv("TOTEM_IDENTIFICADOR", "totem-teste")
    monkeypatch.setenv("PARADA_CODIGO", "123")
    monkeypatch.setenv("PARADA_NOME", "Conjunto Nacional")
    monkeypatch.setenv("PARADA_ENDERECO", "Av. Paulista, 2027")
    monkeypatch.setenv("PARADA_LATITUDE", "-23.558947")
    monkeypatch.setenv("PARADA_LONGITUDE", "-46.659585")
    # Sem token, a subida não chama a SPTrans de verdade mesmo que exista um .env local
    monkeypatch.setenv("SPTRANS_TOKEN", "")
    get_settings.cache_clear()
    with TestClient(criar_app()) as c:
        yield c
    get_settings.cache_clear()
