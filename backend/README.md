# Backend — ViaSP

API em **FastAPI** que orquestra a comunicação entre o frontend do totem e a API Olho Vivo (SPTrans).
Ver [arquitetura](../docs/produto/arquitetura.md) e [diagrama de classes](../docs/produto/diagrama-de-classes.md).

## Rodando

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # preencha SPTRANS_TOKEN e os dados da parada (PARADA_*)
uvicorn app.main:app --reload
```

Docs interativas: http://localhost:8000/docs

## Testes e Lint

```bash
ruff check .
pytest
```

## Dados do Totem Físico

Os dados da parada configurada para simular o totem físico no sistema (referentes à variável de ambiente `PARADA_CODIGO`) são:

* **Código da Parada:** `440016921`
* **Endereço:** Av. Paulista, 2027 (Ref.: R Padre Joao Manuel / R Augusta -- Conjunto Nacional)
* **Coordenadas:** Latitude `-23.558947`, Longitude `-46.659585`

A SPTrans não tem nome cadastrado para essa parada (`/Previsao/Parada` devolve `np` vazio e `Parada/Buscar` não a encontra). Por isso o nome, o endereço e as coordenadas exibidos pelo totem vêm do `.env` quando a SPTrans não os fornece:

```
PARADA_CODIGO=440016921
PARADA_NOME=Conjunto Nacional
PARADA_ENDERECO=Av. Paulista, 2027
PARADA_LATITUDE=-23.558947
PARADA_LONGITUDE=-46.659585
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

## Regra de Paradas Principais (Itinerário Simplificado)

Para evitar poluição visual na interface do totem público (US03), a listagem de paradas de uma linha não retorna o itinerário exaustivo. O backend aplica uma **amostragem proporcional com âncoras** para devolver um itinerário simplificado, seguindo a seguinte lógica:

1. **Limite Máximo ($K$):** O sistema estipula um limite flexível de paradas a serem exibidas na timeline (por padrão, $K = 5$).
2. **Linhas Curtas:** Se a linha possuir um número total de paradas menor ou igual a $K$, o array é retornado integralmente, sem cortes.
3. **Linhas Longas (Amostragem Estratégica):** Se o trajeto exceder $K$ paradas, o algoritmo seleciona exatamente $K$ pontos preservando o contexto do trajeto:
   - A **primeira parada** (índice `0`) é obrigatoriamente inclusa (Origem).
   - A **última parada** (índice `n - 1`) é obrigatoriamente inclusa (Destino Final).
   - As $K - 2$ **paradas intermediárias** são selecionadas escolhendo-se uniformemente as paradas ao longo da lista. 

Isso garante que o usuário tenha a noção exata da direção e das principais vias do percurso, preservando a velocidade da requisição e o layout da tela.