# Backend — ViaSP

API em **FastAPI** que orquestra a comunicação entre o frontend do totem e a API Olho Vivo (SPTrans).
Ver [arquitetura](../docs/produto/arquitetura.md) e [diagrama de classes](../docs/produto/diagrama-de-classes.md).

## Rodando

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # preencha SPTRANS_TOKEN e PARADA_CODIGO
uvicorn app.main:app --reload
```

Docs interativas: http://localhost:8000/docs

## Testes e Lint

```bash
ruff check .
pytest
```

## Estrutura

```
app/
  main.py            # criação do app, lifespan, handlers de erro
  config.py          # Settings (.env)
  excecoes.py        # ErroSPTrans & cia (US08)
  dominio/           # Totem, Parada, Linha, Veiculo, PrevisaoChegada, ConsultaPrevisao
  servicos/          # ServicoConsulta e ClienteSPTrans
  persistencia/      # SQLite (schema) e RepositorioLogs
  api/               # rotas, schemas (resposta) e dependências
tests/
```

## Status

Métodos de negócio levantam `NotImplementedError` (a API responde **501**) até serem implementados.
Funcionando: `/api/saude`, `/api/totem`, criação do banco SQLite.
