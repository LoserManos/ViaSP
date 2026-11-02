import json
import logging
from datetime import datetime
from pathlib import Path

import httpx
import pytest

from app.dominio import (
    ConsultaPrevisao,
    EstadoConsulta,
    Linha,
    Parada,
    PrevisaoChegada,
    Veiculo,
)
from app.excecoes import ErroAutenticacaoSPTrans, ErroSPTrans, SPTransIndisponivel
from app.servicos.cliente_sptrans import ClienteSPTrans, _converter_linha, _mascarar_token

BASE_URL = "https://api.olhovivo.sptrans.com.br/v2.1"
TOKEN_VALIDO = "mock_token_sptrans_ficticio_1234567890"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _carregar_fixture_texto(nome: str) -> str:
    return (FIXTURES_DIR / nome).read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_autenticar_sucesso():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/v2.1/Login/Autenticar"
        assert request.url.params["token"] == TOKEN_VALIDO
        return httpx.Response(200, text="true")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    assert not cliente._autenticado
    await cliente.autenticar()
    assert cliente._autenticado
    await cliente.fechar()


@pytest.mark.asyncio
@pytest.mark.parametrize("token_invalido", ["", "   ", None])
async def test_autenticar_token_vazio(token_invalido):
    chamou_rede = False

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal chamou_rede
        chamou_rede = True
        return httpx.Response(200, text="true")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=token_invalido or "", base_url=BASE_URL, transport=transport)

    with pytest.raises(ErroAutenticacaoSPTrans) as exc_info:
        await cliente.autenticar()

    assert "Token da SPTrans não configurado ou vazio" in str(exc_info.value)
    assert not chamou_rede
    assert not cliente._autenticado
    await cliente.fechar()


@pytest.mark.asyncio
async def test_autenticar_token_recusado_corpo_false():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="false")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(ErroAutenticacaoSPTrans) as exc_info:
        await cliente.autenticar()

    assert "token recusado" in str(exc_info.value)
    assert not cliente._autenticado
    await cliente.fechar()


@pytest.mark.asyncio
async def test_autenticar_token_rejeitado_401():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text='{"Message":"Authorization has been denied."}')

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(ErroAutenticacaoSPTrans) as exc_info:
        await cliente.autenticar()

    assert "token inválido ou não autorizado" in str(exc_info.value)
    assert not cliente._autenticado
    await cliente.fechar()


@pytest.mark.asyncio
async def test_autenticar_erro_5xx():
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(502, text="Bad Gateway")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente.autenticar()

    assert "HTTP 502" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_autenticar_timeout():
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("Timeout ao ler resposta")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente.autenticar()

    assert "Timeout ao autenticar" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_autenticar_erro_de_rede():
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Falha na conexão de rede")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente.autenticar()

    assert "Falha de conexão ao autenticar" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_primeira_chamada_autentica_automaticamente():
    requisicoes = []

    def handler(request: httpx.Request) -> httpx.Response:
        requisicoes.append(f"{request.method} {request.url.path}")
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            return httpx.Response(200, json=[{"cl": 1, "lt": "8000"}])
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    assert not cliente._autenticado
    resposta = await cliente._requisitar("GET", "/Linha/Buscar", params={"termosBusca": "8000"})
    assert resposta.status_code == 200
    assert resposta.json() == [{"cl": 1, "lt": "8000"}]
    assert cliente._autenticado
    assert requisicoes == [
        "POST /v2.1/Login/Autenticar",
        "GET /v2.1/Linha/Buscar",
    ]
    await cliente.fechar()


@pytest.mark.asyncio
async def test_sessao_expirada_reautentica_uma_vez_e_repete():
    tentativas_busca = 0
    chamadas_login = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal tentativas_busca, chamadas_login
        if request.url.path == "/v2.1/Login/Autenticar":
            chamadas_login += 1
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            tentativas_busca += 1
            if tentativas_busca == 1:
                return httpx.Response(401, json={"Message": "Authorization has been denied for this request."})
            return httpx.Response(200, json=[{"cl": 2506, "lt": "8000"}])
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    await cliente.autenticar()
    assert chamadas_login == 1

    resposta = await cliente._requisitar("GET", "/Linha/Buscar")
    assert resposta.status_code == 200
    assert resposta.json() == [{"cl": 2506, "lt": "8000"}]
    assert chamadas_login == 2
    assert tentativas_busca == 2
    assert cliente._autenticado
    await cliente.fechar()


@pytest.mark.asyncio
async def test_sessao_expirada_falha_persistente_apos_reautenticacao():
    chamadas_login = 0
    chamadas_busca = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas_login, chamadas_busca
        if request.url.path == "/v2.1/Login/Autenticar":
            chamadas_login += 1
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            chamadas_busca += 1
            return httpx.Response(401, json={"Message": "Authorization has been denied for this request."})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    with pytest.raises(ErroAutenticacaoSPTrans) as exc_info:
        await cliente._requisitar("GET", "/Linha/Buscar")

    assert "Sessão da SPTrans expirada e reautenticação falhou" in str(exc_info.value)
    assert chamadas_login == 2
    assert chamadas_busca == 2
    await cliente.fechar()


@pytest.mark.asyncio
async def test_requisicao_timeout_gera_sptrans_indisponivel():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        raise httpx.ReadTimeout("Timeout ao esperar dados")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)
    await cliente.autenticar()

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente._requisitar("GET", "/Linha/Buscar")

    assert "Timeout ao comunicar com a SPTrans" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_requisicao_erro_rede_gera_sptrans_indisponivel():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        raise httpx.ConnectError("Conexão recusada")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)
    await cliente.autenticar()

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente._requisitar("GET", "/Linha/Buscar")

    assert "Falha de conexão com a SPTrans" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_requisicao_5xx_gera_sptrans_indisponivel():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(503, text="Service Unavailable")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)
    await cliente.autenticar()

    with pytest.raises(SPTransIndisponivel) as exc_info:
        await cliente._requisitar("GET", "/Linha/Buscar")

    assert "HTTP 503" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_requisicao_4xx_generico_gera_erro_sptrans():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(400, json={"Message": "The request is invalid."})

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)
    await cliente.autenticar()

    with pytest.raises(ErroSPTrans) as exc_info:
        await cliente._requisitar("GET", "/Linha/Buscar")

    assert "HTTP 400" in str(exc_info.value)
    await cliente.fechar()


@pytest.mark.asyncio
async def test_token_mascarado_em_logs_e_excecoes(caplog):
    token_secreto = "segredo_super_longo_1234567890_token_sptrans"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(401, text="Unauthorized")

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=token_secreto, base_url=BASE_URL, transport=transport)

    with caplog.at_level(logging.DEBUG):
        with pytest.raises(ErroAutenticacaoSPTrans) as exc_info:
            await cliente.autenticar()

    assert token_secreto not in str(exc_info.value)
    for registro in caplog.records:
        assert token_secreto not in registro.message
    assert "segr...rans" in caplog.text
    await cliente.fechar()


def test_funcao_mascarar_token():
    assert _mascarar_token("") == "<vazio>"
    assert _mascarar_token("123456") == "***"
    assert _mascarar_token("12345678") == "***"
    assert _mascarar_token("123456789") == "1234...6789"
    assert _mascarar_token(TOKEN_VALIDO) == f"{TOKEN_VALIDO[:4]}...{TOKEN_VALIDO[-4:]}"


@pytest.mark.asyncio
async def test_timeout_configuravel():
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, timeout=42.5)
    assert cliente._timeout == 42.5
    assert cliente._http.timeout.read == 42.5
    await cliente.fechar()


# --- ISS-06: Linhas e Paradas ---


@pytest.mark.asyncio
async def test_buscar_linhas_com_fixture_real():
    fixture_linhas = _carregar_fixture_texto("linha_buscar.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            assert request.url.params["termosBusca"] == "8000"
            return httpx.Response(200, text=fixture_linhas, headers={"Content-Type": "application/json"})
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    linhas = await cliente.buscar_linhas("8000")
    await cliente.fechar()

    assert len(linhas) == 4
    assert linhas[0] == Linha(
        codigo=2506,
        numero="8000-1",
        sentido=1,
        origem="TERM. LAPA",
        destino="PÇA. RAMOS DE AZEVEDO",
    )
    assert linhas[1] == Linha(
        codigo=35274,
        numero="8000-1",
        sentido=2,
        origem="PÇA. RAMOS DE AZEVEDO",
        destino="TERM. LAPA",
    )
    assert linhas[2] == Linha(
        codigo=1273,
        numero="8000-10",
        sentido=1,
        origem="TERM. LAPA",
        destino="PÇA. RAMOS DE AZEVEDO",
    )
    assert linhas[3] == Linha(
        codigo=34041,
        numero="8000-10",
        sentido=2,
        origem="PÇA. RAMOS DE AZEVEDO",
        destino="TERM. LAPA",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("corpo_vazio", ["[]", "", "null"])
async def test_buscar_linhas_resposta_vazia_retorna_lista_vazia(corpo_vazio: str):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, text=corpo_vazio)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    assert await cliente.buscar_linhas("inexistente") == []
    await cliente.fechar()


@pytest.mark.asyncio
async def test_buscar_linhas_campos_ausentes_ou_nulos_nao_derrubam_parsing():
    payload = [
        {"cl": 100, "lt": "175P"},
        {"cl": 200, "lt": "875A", "tl": None, "sl": 2, "tp": "PERDIZES", "ts": None},
        {"lt": "SEM_CODIGO"},
        None,
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, json=payload)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    linhas = await cliente.buscar_linhas("teste")
    await cliente.fechar()

    assert linhas == [
        Linha(codigo=100, numero="175P", sentido=1, origem="", destino=""),
        Linha(codigo=200, numero="875A", sentido=2, origem="PERDIZES", destino=""),
    ]


@pytest.mark.asyncio
async def test_buscar_paradas_com_fixture_real():
    fixture_paradas = _carregar_fixture_texto("paradas_por_linha.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Parada/BuscarParadasPorLinha":
            assert request.url.params["codigoLinha"] == "1273"
            return httpx.Response(200, text=fixture_paradas, headers={"Content-Type": "application/json"})
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    paradas = await cliente.buscar_paradas(1273)
    await cliente.fechar()

    assert len(paradas) == 13
    assert paradas[0] == Parada(
        codigo=614432,
        nome="BABY BARIONY C/B",
        endereco="R   PEDRO MACHADO",
        latitude=-23.527606,
        longitude=-46.671514,
    )
    assert paradas[2] == Parada(
        codigo=60014604,
        nome="SESC POMPEIA C/B",
        endereco="VDTO POMPEIA/ R JOAQUIM FERREIRA",
        latitude=-23.525262,
        longitude=-46.682254,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("corpo_vazio", ["[]", "", "null"])
async def test_buscar_paradas_resposta_vazia_retorna_lista_vazia(corpo_vazio: str):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, text=corpo_vazio)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    assert await cliente.buscar_paradas(9999) == []
    await cliente.fechar()


@pytest.mark.asyncio
async def test_buscar_paradas_campos_ausentes_nao_derrubam_parsing():
    payload = [
        {"cp": 440016921, "py": -23.558947, "px": -46.659585},
        {"cp": 12345, "np": None, "ed": "AV PAULISTA", "py": None, "px": "invalido"},
        {"np": "SEM CODIGO"},
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, json=payload)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    paradas = await cliente.buscar_paradas(1273)
    await cliente.fechar()

    assert paradas == [
        Parada(codigo=440016921, nome="", endereco="", latitude=-23.558947, longitude=-46.659585),
        Parada(codigo=12345, nome="", endereco="AV PAULISTA", latitude=0.0, longitude=0.0),
    ]


@pytest.mark.asyncio
async def test_buscar_linhas_da_parada_conforme_adr_001_com_fixtures_reais():
    fixture_linhas = _carregar_fixture_texto("linha_buscar.json")
    fixture_paradas = _carregar_fixture_texto("paradas_por_linha.json")
    chamadas_login = 0
    paradas_consultadas: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal chamadas_login
        if request.url.path == "/v2.1/Login/Autenticar":
            chamadas_login += 1
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            return httpx.Response(200, text=fixture_linhas, headers={"Content-Type": "application/json"})
        if request.url.path == "/v2.1/Parada/BuscarParadasPorLinha":
            codigo_linha = request.url.params["codigoLinha"]
            paradas_consultadas.append(codigo_linha)
            if codigo_linha in {"1273", "2506"}:
                return httpx.Response(200, text=fixture_paradas, headers={"Content-Type": "application/json"})
            return httpx.Response(200, json=[])
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    linhas = await cliente.buscar_linhas_da_parada(60014604, termos_busca=["8000", "LAPA"])
    await cliente.fechar()

    assert chamadas_login == 1
    assert sorted(paradas_consultadas) == ["1273", "2506", "34041", "35274"]
    assert linhas == [
        Linha(
            codigo=2506,
            numero="8000-1",
            sentido=1,
            origem="TERM. LAPA",
            destino="PÇA. RAMOS DE AZEVEDO",
        ),
        Linha(
            codigo=1273,
            numero="8000-10",
            sentido=1,
            origem="TERM. LAPA",
            destino="PÇA. RAMOS DE AZEVEDO",
        ),
    ]


@pytest.mark.asyncio
async def test_buscar_linhas_da_parada_sem_resultado_ou_termos_vazios():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Linha/Buscar":
            if request.url.params["termosBusca"] == "8":
                return httpx.Response(
                    200,
                    json=[{"cl": 1273, "lt": "8000", "tl": 10, "sl": 1, "tp": "A", "ts": "B"}],
                )
            return httpx.Response(200, json=[])
        if request.url.path == "/v2.1/Parada/BuscarParadasPorLinha":
            return httpx.Response(200, json=[{"cp": 111, "np": "OUTRA PARADA"}])
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    assert await cliente.buscar_linhas_da_parada(999999, termos_busca=[]) == []
    assert await cliente.buscar_linhas_da_parada(999999) == []
    await cliente.fechar()


@pytest.mark.asyncio
async def test_buscar_parada_com_fixture_real():
    fixture_parada_buscar = _carregar_fixture_texto("parada_buscar.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Parada/Buscar":
            return httpx.Response(200, text=fixture_parada_buscar, headers={"Content-Type": "application/json"})
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    parada = await cliente.buscar_parada(260015039)
    parada_cb = await cliente.buscar_parada(260016855, termo="PAULISTA")
    inexistente = await cliente.buscar_parada(999999999)
    await cliente.fechar()

    assert parada == Parada(
        codigo=260015039,
        nome="PAULISTA B/C",
        endereco="AV PAULISTA/ AV REBOUCAS",
        latitude=-23.555883,
        longitude=-46.66306,
    )
    assert parada_cb == Parada(
        codigo=260016855,
        nome="PAULISTA C/B",
        endereco="AV PAULISTA/ R ANTONIO CARLOS",
        latitude=-23.555176,
        longitude=-46.66237,
    )
    assert inexistente is None


@pytest.mark.asyncio
async def test_resposta_json_malformado_levanta_erro_sptrans():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, text="{json quebrado")

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    with pytest.raises(ErroSPTrans, match="JSON malformado"):
        await cliente.buscar_linhas("8000")
    await cliente.fechar()


def test_converter_linha_suporta_formato_previsao_parada_fixture_real():
    dados = json.loads(_carregar_fixture_texto("previsao_parada.json"))
    linhas_json = dados["p"]["l"]

    primeira = _converter_linha(linhas_json[0])
    sentido_2 = _converter_linha(linhas_json[4])

    assert primeira == Linha(
        codigo=485,
        numero="702C-10",
        sentido=1,
        origem="JD. BONFIGLIOLI",
        destino="METRÔ BELÉM",
    )
    assert sentido_2 == Linha(
        codigo=33328,
        numero="178L-10",
        sentido=2,
        origem="HOSP. DAS CLÍNICAS",
        destino="LAUZANE PAULISTA",
    )


@pytest.mark.asyncio
async def test_buscar_linhas_com_previsao_usa_previsao_parada():
    fixture = _carregar_fixture_texto("previsao_parada.json")
    caminhos = []

    def handler(request: httpx.Request) -> httpx.Response:
        caminhos.append(request.url.path)
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        assert request.url.path == "/v2.1/Previsao/Parada"
        assert request.url.params["codigoParada"] == "260015039"
        return httpx.Response(200, text=fixture, headers={"Content-Type": "application/json"})

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    linhas = await cliente.buscar_linhas_com_previsao(260015039)
    await cliente.fechar()

    esperadas = {item["cl"] for item in json.loads(fixture)["p"]["l"]}
    assert {linha.codigo for linha in linhas} == esperadas
    assert linhas == sorted(linhas, key=lambda linha: (linha.numero, linha.sentido))
    assert caminhos.count("/v2.1/Previsao/Parada") == 1


@pytest.mark.asyncio
async def test_buscar_linhas_com_previsao_sem_dados_retorna_vazio():
    fixture_nula = _carregar_fixture_texto("previsao_parada_nula.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, text=fixture_nula, headers={"Content-Type": "application/json"})

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    assert await cliente.buscar_linhas_com_previsao(999999) == []
    await cliente.fechar()


# --- ISS-07: Previsões de Chegada ---


@pytest.mark.asyncio
async def test_obter_previsoes_com_fixture_real():
    fixture_previsao = _carregar_fixture_texto("previsao_parada.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Previsao":
            assert request.url.params["codigoParada"] == "260015039"
            assert request.url.params["codigoLinha"] in {"485", "33328"}
            return httpx.Response(200, text=fixture_previsao, headers={"Content-Type": "application/json"})
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    consulta = await cliente.obter_previsoes(codigo_parada=260015039, codigo_linha=485)
    consulta_sentido_2 = await cliente.obter_previsoes(codigo_parada=260015039, codigo_linha=33328)
    await cliente.fechar()

    assert isinstance(consulta, ConsultaPrevisao)
    assert isinstance(consulta.horario_consulta, datetime)
    assert consulta.horario_referencia == "13:25"
    assert consulta.estado == EstadoConsulta.SUCESSO
    assert consulta.foi_bem_sucedida() is True
    assert consulta.possui_previsoes() is True
    assert consulta.parada == Parada(
        codigo=260015039,
        nome="PAULISTA B/C",
        endereco="",
        latitude=-23.555883,
        longitude=-46.66306,
    )
    assert consulta.linha == Linha(
        codigo=485,
        numero="702C-10",
        sentido=1,
        origem="JD. BONFIGLIOLI",
        destino="METRÔ BELÉM",
    )
    assert consulta.previsoes == [
        PrevisaoChegada(horario_previsto="13:26", veiculo=Veiculo(prefixo="81506")),
        PrevisaoChegada(horario_previsto="13:36", veiculo=Veiculo(prefixo="81504")),
        PrevisaoChegada(horario_previsto="13:47", veiculo=Veiculo(prefixo="81508")),
        PrevisaoChegada(horario_previsto="14:00", veiculo=Veiculo(prefixo="81502")),
    ]
    assert consulta.previsoes[0].calcular_tempo_de_espera(consulta.horario_referencia) == 1

    assert consulta_sentido_2.linha == Linha(
        codigo=33328,
        numero="178L-10",
        sentido=2,
        origem="HOSP. DAS CLÍNICAS",
        destino="LAUZANE PAULISTA",
    )
    assert consulta_sentido_2.previsoes == [
        PrevisaoChegada(horario_previsto="13:29", veiculo=Veiculo(prefixo="22606")),
    ]


@pytest.mark.asyncio
async def test_obter_previsoes_parada_nula_fixture_real():
    fixture_nula = _carregar_fixture_texto("previsao_parada_nula.json")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        if request.url.path == "/v2.1/Previsao":
            return httpx.Response(200, text=fixture_nula, headers={"Content-Type": "application/json"})
        return httpx.Response(404)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    consulta = await cliente.obter_previsoes(codigo_parada=440016921, codigo_linha=1273)
    await cliente.fechar()

    assert consulta.horario_referencia == "14:09"
    assert consulta.estado == EstadoConsulta.SEM_PREVISAO
    assert consulta.foi_bem_sucedida() is True
    assert consulta.possui_previsoes() is False
    assert consulta.previsoes == []
    assert consulta.parada.codigo == 440016921
    assert consulta.linha.codigo == 1273


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "payload",
    [
        {"hr": "03:15", "p": {"cp": 440016921, "np": "PAULISTA", "l": []}},
        {"hr": "03:15", "p": {"cp": 440016921, "np": "PAULISTA", "l": [{"cl": 1273, "c": "8000-10", "vs": []}]}},
        {"hr": "03:15", "p": {"cp": 440016921, "np": "PAULISTA", "l": [{"cl": 1273, "c": "8000-10", "vs": None}]}},
        {"hr": "03:15", "p": {"cp": 440016921, "np": "PAULISTA", "l": [{"cl": 9999, "c": "OUTRA", "vs": []}]}},
    ],
)
async def test_obter_previsoes_sem_veiculos_retorna_estado_sem_previsao(payload: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, json=payload)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    consulta = await cliente.obter_previsoes(codigo_parada=440016921, codigo_linha=1273)
    await cliente.fechar()

    assert consulta.estado == EstadoConsulta.SEM_PREVISAO
    assert consulta.horario_referencia == "03:15"
    assert consulta.previsoes == []
    assert consulta.foi_bem_sucedida() is True
    assert consulta.possui_previsoes() is False


@pytest.mark.asyncio
@pytest.mark.parametrize("corpo_vazio", ["", "null", "[]"])
async def test_obter_previsoes_corpo_vazio_ou_nao_objeto(corpo_vazio: str):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, text=corpo_vazio)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    consulta = await cliente.obter_previsoes(codigo_parada=440016921, codigo_linha=1273)
    await cliente.fechar()

    assert consulta.estado == EstadoConsulta.SEM_PREVISAO
    assert consulta.horario_referencia == ""
    assert consulta.previsoes == []


@pytest.mark.asyncio
async def test_obter_previsoes_campos_ausentes_ou_nulos_nao_derrubam_parsing():
    payload = {
        "hr": None,
        "p": {
            "cp": None,
            "np": None,
            "py": None,
            "px": None,
            "l": [
                {
                    "vs": [
                        {"t": "15:10"},
                        {"p": 98765, "t": "15:20"},
                        {"p": "11111", "t": None},
                        {"p": "22222", "t": "   "},
                        None,
                    ],
                }
            ],
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(200, json=payload)

    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=httpx.MockTransport(handler))
    consulta = await cliente.obter_previsoes(codigo_parada=440016921, codigo_linha=1273)
    await cliente.fechar()

    assert consulta.estado == EstadoConsulta.SUCESSO
    assert consulta.horario_referencia == ""
    assert consulta.parada == Parada(codigo=440016921, nome="", endereco="", latitude=0.0, longitude=0.0)
    assert consulta.linha == Linha(codigo=1273, numero="", sentido=1, origem="", destino="")
    assert consulta.previsoes == [
        PrevisaoChegada(horario_previsto="15:10", veiculo=Veiculo(prefixo="")),
        PrevisaoChegada(horario_previsto="15:20", veiculo=Veiculo(prefixo="98765")),
    ]


@pytest.mark.asyncio
async def test_obter_previsoes_propaga_excecoes_de_comunicacao_iss05():
    def handler_timeout(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        raise httpx.ReadTimeout("Timeout em /Previsao")

    cliente_timeout = ClienteSPTrans(
        token=TOKEN_VALIDO,
        base_url=BASE_URL,
        transport=httpx.MockTransport(handler_timeout),
    )
    with pytest.raises(SPTransIndisponivel):
        await cliente_timeout.obter_previsoes(440016921, 1273)
    await cliente_timeout.fechar()

    cliente_sem_token = ClienteSPTrans(
        token="",
        base_url=BASE_URL,
        transport=httpx.MockTransport(handler_timeout),
    )
    with pytest.raises(ErroAutenticacaoSPTrans):
        await cliente_sem_token.obter_previsoes(440016921, 1273)
    await cliente_sem_token.fechar()

    def handler_400(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v2.1/Login/Autenticar":
            return httpx.Response(200, text="true")
        return httpx.Response(400, json={"Message": "The request is invalid."})

    cliente_400 = ClienteSPTrans(
        token=TOKEN_VALIDO,
        base_url=BASE_URL,
        transport=httpx.MockTransport(handler_400),
    )
    with pytest.raises(ErroSPTrans):
        await cliente_400.obter_previsoes(440016921, 1273)
    await cliente_400.fechar()
