def test_saude(client):
    resposta = client.get("/api/saude")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_totem_usa_configuracao(client):
    corpo = client.get("/api/totem").json()
    assert corpo["identificador"] == "totem-teste"
    assert corpo["parada"]["codigo"] == 123


def test_rotas_de_consulta_ainda_nao_implementadas(client):
    # Remover/ajustar conforme cada método for implementado.
    assert client.get("/api/linhas").status_code == 501
    assert client.get("/api/previsoes", params={"codigo_linha": 1}).status_code == 501
