from app.persistencia import conectar, inicializar_banco


def test_inicializar_banco_cria_tabela_de_logs(tmp_path):
    caminho = str(tmp_path / "x.db")
    inicializar_banco(caminho)
    with conectar(caminho) as c:
        tabelas = {r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert "log_consulta" in tabelas
