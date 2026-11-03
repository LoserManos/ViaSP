import pytest

AREA_PAULISTA = {"lat_min": -23.56, "lat_max": -23.557, "lon_min": -46.668, "lon_max": -46.659}


@pytest.fixture
def client_dev(criar_client):
    return criar_client(MODO_DEV="true")


def test_rotas_dev_nao_existem_fora_do_modo_dev(client):
    assert client.get("/api/dev/paradas", params=AREA_PAULISTA).status_code == 404
    assert client.put("/api/dev/parada", json={"codigo": 440015007}).status_code in (404, 405)


def test_lista_paradas_na_area(client_dev):
    corpo = client_dev.get("/api/dev/paradas", params=AREA_PAULISTA).json()

    assert corpo["truncado"] is False
    assert [p["codigo"] for p in corpo["paradas"]] == [440015007, 440016921]
    assert corpo["paradas"][0]["nome"] == "Clínicas C/B"


def test_indica_quando_ha_mais_paradas_que_o_limite(client_dev):
    corpo = client_dev.get("/api/dev/paradas", params={**AREA_PAULISTA, "limite": 1}).json()

    assert len(corpo["paradas"]) == 1
    assert corpo["truncado"] is True


def test_escolher_parada_troca_a_parada_do_totem(client_dev):
    resposta = client_dev.put("/api/dev/parada", json={"codigo": 440015007})

    assert resposta.status_code == 200
    assert resposta.json()["parada"]["nome"] == "Clínicas C/B"
    totem = client_dev.get("/api/totem").json()
    assert totem["identificador"] == "totem-teste"
    assert totem["parada"]["codigo"] == 440015007


def test_escolher_parada_inexistente(client_dev):
    resposta = client_dev.put("/api/dev/parada", json={"codigo": 1})

    assert resposta.status_code == 404
    assert resposta.json()["codigo"] == "parada_nao_encontrada"
    assert client_dev.get("/api/totem").json()["parada"]["codigo"] == 440016921
