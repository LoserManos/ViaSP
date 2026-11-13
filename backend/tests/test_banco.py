from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.dominio import ConsultaPrevisao, EstadoConsulta, Linha, Parada, PrevisaoChegada, Veiculo
from app.persistencia import RepositorioLogs, conectar, inicializar_banco


def test_inicializar_banco_cria_tabela_de_logs(tmp_path):
    caminho = str(tmp_path / "x.db")
    inicializar_banco(caminho)
    with conectar(caminho) as c:
        tabelas = {r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "log_consulta" in tabelas


def test_inicializar_banco_cria_tabela_de_paradas_do_gtfs(tmp_path):
    caminho = str(tmp_path / "x.db")
    inicializar_banco(caminho)
    with conectar(caminho) as c:
        tabelas = {r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "parada_gtfs" in tabelas


def test_registrar_consulta_insere_dados_no_banco_temporario(tmp_path):
    caminho = str(tmp_path / "logs.db")
    inicializar_banco(caminho)
    repositorio = RepositorioLogs(caminho)

    parada = Parada(codigo=440016921, nome="Av. Paulista, 2027")
    linha = Linha(codigo=2506, numero="8000-10", sentido=1)
    horario = datetime(2026, 11, 8, 18, 0, tzinfo=ZoneInfo("America/Sao_Paulo"))

    consulta_sucesso = ConsultaPrevisao(
        parada=parada,
        linha=linha,
        horario_consulta=horario,
        horario_referencia="18:00",
        estado=EstadoConsulta.SUCESSO,
        previsoes=[PrevisaoChegada(horario_previsto="18:05", veiculo=Veiculo(prefixo="81506"))],
        latencia_ms=145,
    )
    consulta_falha = ConsultaPrevisao(
        parada=parada,
        linha=linha,
        horario_consulta=horario,
        estado=EstadoConsulta.FALHA,
        mensagem_erro="SPTrans indisponível no momento.",
        latencia_ms=320,
    )

    repositorio.registrar_consulta("totem-001", consulta_sucesso)
    repositorio.registrar_consulta("totem-001", consulta_falha, latencia_ms=350, erro="Timeout na chamada")

    with conectar(caminho) as c:
        linhas = c.execute("SELECT * FROM log_consulta ORDER BY id").fetchall()

    assert len(linhas) == 2

    primeiro = linhas[0]
    assert primeiro["totem_id"] == "totem-001"
    assert primeiro["codigo_parada"] == 440016921
    assert primeiro["codigo_linha"] == 2506
    assert primeiro["estado"] == "sucesso"
    assert primeiro["latencia_ms"] == 145
    assert primeiro["erro"] is None
    assert primeiro["criado_em"]

    segundo = linhas[1]
    assert segundo["totem_id"] == "totem-001"
    assert segundo["codigo_parada"] == 440016921
    assert segundo["codigo_linha"] == 2506
    assert segundo["estado"] == "falha"
    assert segundo["latencia_ms"] == 350
    assert segundo["erro"] == "Timeout na chamada"


def test_registrar_consulta_nunca_grava_token_no_banco(tmp_path, monkeypatch):
    caminho = str(tmp_path / "logs.db")
    inicializar_banco(caminho)
    monkeypatch.setenv("SPTRANS_TOKEN", "meu-token-super-secreto-999")
    get_settings.cache_clear()

    try:
        repositorio = RepositorioLogs(caminho)
        consulta = ConsultaPrevisao(
            parada=Parada(codigo=440016921),
            linha=Linha(codigo=2506, numero="8000-10", sentido=1),
            horario_consulta=datetime(2026, 11, 8, 18, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
            estado=EstadoConsulta.FALHA,
            mensagem_erro="Falha em POST /Login/Autenticar?token=outro-segredo com chave meu-token-super-secreto-999",
            latencia_ms=50,
        )

        repositorio.registrar_consulta("totem-001", consulta)

        with conectar(caminho) as c:
            registro = c.execute("SELECT * FROM log_consulta").fetchone()

        assert registro is not None
        assert "outro-segredo" not in registro["erro"]
        assert "meu-token-super-secreto-999" not in registro["erro"]
        assert "token=***" in registro["erro"]
    finally:
        get_settings.cache_clear()


def test_registrar_consulta_nao_propaga_erro_quando_banco_indisponivel(tmp_path):
    # Passa o caminho de um diretório em vez de arquivo SQLite válido
    repositorio = RepositorioLogs(str(tmp_path))
    consulta = ConsultaPrevisao(
        parada=Parada(codigo=440016921),
        linha=Linha(codigo=2506, numero="8000-10", sentido=1),
        horario_consulta=datetime(2026, 11, 8, 18, 0, tzinfo=ZoneInfo("America/Sao_Paulo")),
        estado=EstadoConsulta.SUCESSO,
        latencia_ms=10,
    )

    # Não deve levantar exceção
    repositorio.registrar_consulta("totem-001", consulta)
