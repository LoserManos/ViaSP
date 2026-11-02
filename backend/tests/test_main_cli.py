import os

import pytest

from app.__main__ import main


@pytest.fixture
def chamadas(monkeypatch):
    registradas = []
    monkeypatch.setattr("uvicorn.run", lambda app, **opcoes: registradas.append((app, opcoes)))
    monkeypatch.delenv("MODO_DEV", raising=False)
    return registradas


def test_sem_dev_sobe_o_totem_sem_rotas_de_dev(chamadas):
    main([])

    app, opcoes = chamadas[0]
    assert app == "app.main:app"
    assert opcoes["reload"] is False
    assert opcoes["port"] == 8000
    assert os.environ["MODO_DEV"] == "false"


def test_dev_liga_rotas_de_dev_e_recarga(chamadas):
    main(["--dev", "--porta", "8001"])

    _, opcoes = chamadas[0]
    assert opcoes["reload"] is True
    assert opcoes["reload_dirs"] == ["app"]
    assert opcoes["port"] == 8001
    assert os.environ["MODO_DEV"] == "true"
