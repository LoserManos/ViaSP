import pytest

from app.api.dependencias import get_servico_consulta
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel


def test_saude(client):
    resposta = client.get("/api/saude")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_totem_usa_configuracao(client):
    corpo = client.get("/api/totem").json()
    assert corpo["identificador"] == "totem-teste"
    assert corpo["parada"]["codigo"] == 123


class _ServicoQueFalha:
    def __init__(self, excecao: Exception) -> None:
        self._excecao = excecao

    async def buscar_linhas(self, parada, termo=""):
        raise self._excecao


@pytest.mark.parametrize(
    ("excecao", "status", "codigo"),
    [
        (ErroAutenticacaoSPTrans("token inválido"), 502, "erro_autenticacao"),
        (SPTransIndisponivel("timeout"), 503, "sptrans_indisponivel"),
        (ErroSPTrans("resposta inesperada"), 502, "erro_sptrans"),
    ],
)
def test_erros_da_sptrans_seguem_formato_padrao(client, excecao, status, codigo):
    client.app.dependency_overrides[get_servico_consulta] = lambda: _ServicoQueFalha(excecao)

    resposta = client.get("/api/linhas")

    corpo = resposta.json()
    assert resposta.status_code == status
    assert set(corpo) == {"codigo", "mensagem", "tentar_novamente"}
    assert corpo["codigo"] == codigo
    assert corpo["tentar_novamente"] is True
    # A mensagem é para o passageiro: não vaza o detalhe técnico da exceção
    assert corpo["mensagem"] and str(excecao) not in corpo["mensagem"]


def test_parametro_invalido_retorna_422_no_formato_padrao(client):
    resposta = client.get("/api/previsoes", params={"codigo_linha": "abc"})

    assert resposta.status_code == 422
    assert resposta.json() == {
        "codigo": "requisicao_invalida",
        "mensagem": "Parâmetros da requisição inválidos.",
        "tentar_novamente": False,
    }


def test_parametro_obrigatorio_ausente_retorna_422(client):
    resposta = client.get("/api/previsoes")

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "requisicao_invalida"
