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
from app.servicos.cliente_sptrans import ClienteSPTrans, _mascarar_token

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
                # Simula cookie expirado na primeira consulta
                return httpx.Response(401, json={"Message": "Authorization has been denied for this request."})
            # Na repetição pós-reautenticação, sucesso
            return httpx.Response(200, json=[{"cl": 2506, "lt": "8000"}])
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    cliente = ClienteSPTrans(token=TOKEN_VALIDO, base_url=BASE_URL, transport=transport)

    # Autentica inicialmente
    await cliente.autenticar()
    assert chamadas_login == 1

    # Faz requisição com sessão simulada expirada
    resposta = await cliente._requisitar("GET", "/Linha/Buscar")
    assert resposta.status_code == 200
    assert resposta.json() == [{"cl": 2506, "lt": "8000"}]
    assert chamadas_login == 2  # Reautenticou uma vez
    assert tentativas_busca == 2  # Tentou e repetiu a chamada
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
            # Rejeita sempre
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

    # O token bruto NUNCA deve aparecer no texto da exceção
    assert token_secreto not in str(exc_info.value)

    # O token bruto NUNCA deve aparecer nos logs capturados
    for registro in caplog.records:
        assert token_secreto not in registro.message

    # Confirma que a versão mascarada foi utilizada no log informativo
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
                    # sem cl, c, sl, lt0, lt1
                    "vs": [
                        {"t": "15:10"},  # sem prefixo 'p' -> deve virar prefixo ""
                        {"p": 98765, "t": "15:20"},  # prefixo numérico
                        {"p": "11111", "t": None},  # sem horário previsto -> ignorado
                        {"p": "22222", "t": "   "},  # horário em branco -> ignorado
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
