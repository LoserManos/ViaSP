# Backend — ViaSP

API em **FastAPI** que orquestra a comunicação entre o frontend do totem e a API Olho Vivo (SPTrans).
Ver [arquitetura](../docs/produto/arquitetura.md) e [diagrama de classes](../docs/produto/diagrama-de-classes.md).

## Rodando

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # preencha SPTRANS_TOKEN
python -m app --dev         # ou só `python -m app`, sem as rotas de dev
```

`python -m app --help` lista as opções (`--dev`, `--host`, `--porta`).

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

A API Olho Vivo não tem nome cadastrado para essa parada (`/Previsao/Parada` devolve `np` vazio e `Parada/Buscar` não a encontra). Por isso nome, endereço e coordenadas vêm do **GTFS da SPTrans**.

## GTFS da SPTrans

O GTFS tem todas as paradas da cidade (cerca de 22 mil) com nome e coordenadas. O backend importa o `stops.txt` para o SQLite na primeira subida.

1. Entre na [área do desenvolvedor da SPTrans](https://www.sptrans.com.br/desenvolvedores/) (mesma conta do token) e baixe o GTFS.
2. Coloque a pasta descompactada ou o `.zip` em `backend/data/gtfs/` (fica fora do git).
3. Suba o backend. Para importar um GTFS mais novo, apague `data/totem.db` e suba de novo.

Sem o GTFS o totem ainda funciona, mas a parada aparece como "Parada 440016921", sem nome nem coordenadas.

## Modo dev: escolher a parada no mapa

Subindo com `python -m app --dev`, o backend libera `/api/dev/paradas` e `/api/dev/parada` (ver [contrato](../docs/produto/api.md#6-rotas-de-desenvolvimento---dev)) e o frontend, rodando com `npm run dev`, mostra o botão **Escolher parada** no cabeçalho. Ele abre um mapa com as paradas do GTFS; tocar numa parada e confirmar muda a parada do totem até o backend reiniciar.

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

## Cache em Memória e Proteção da API Externa

Para evitar chamadas repetidas à SPTrans quando vários passageiros consultam o mesmo ponto e manter o totem útil durante oscilações da API externa, o `ServicoConsulta` mantém cache em memória configurável via variáveis de ambiente (`.env`):

* `CACHE_TTL_LINHAS_SEGUNDOS` (padrão `60`): linhas com previsão no ponto (`/Previsao/Parada`).
* `CACHE_TTL_PARADAS_SEGUNDOS` (padrão `3600`): paradas do itinerário da linha (dado quase estático).
* `CACHE_TTL_PREVISOES_SEGUNDOS` (padrão `15`): previsões de chegada por parada e linha.

Se a SPTrans falhar após o vencimento do TTL e houver um resultado válido anterior em cache, o backend devolve esse último resultado marcado como desatualizado (`desatualizado: true` em `/api/previsoes` e cabeçalho `X-Dados-Desatualizados: true` nas rotas de consulta).
