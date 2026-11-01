# Contrato da API REST - ViaSP

Todas as rotas têm o prefixo `/api`. O servidor roda por padrão em `http://localhost:8000`.

## 1. `GET /api/totem`
Retorna as informações da parada onde o totem está instalado (útil para o mapa da US05).

**Resposta (200 OK):**
```json
{
  "identificador": "TOTEM-01",
  "parada": {
    "codigo": 12345,
    "nome": "PAULISTA B/C",
    "endereco": "AV PAULISTA",
    "latitude": -23.555883,
    "longitude": -46.66306
  }
}
```

## 2. `GET /api/linhas?termo={busca}`
Retorna as linhas do ponto. O parâmetro `termo` é opcional (usado para a busca da US02).

**Resposta (200 OK):**
```json
[
  {
    "codigo": 2506,
    "numero": "8000-1",
    "sentido": 1,
    "origem": "TERM. LAPA",
    "destino": "PÇA. RAMOS DE AZEVEDO"
  }
]
```

## 3. `GET /api/linhas/{codigo_linha}/paradas`
Retorna as paradas principais do itinerário da linha selecionada (US03).

**Resposta (200 OK):**
```json
[
  {
    "codigo": 614432,
    "nome": "BABY BARIONY C/B",
    "endereco": "R PEDRO MACHADO",
    "latitude": -23.527606,
    "longitude": -46.671514
  }
]
```

## 4. `GET /api/previsoes?codigo_linha={codigo}`
Retorna as previsões de chegada para a parada do totem e a linha escolhida (US06 e US07).

**Resposta (200 OK - Sucesso):**
```json
{
  "parada": {
    "codigo": 12345,
    "nome": "PAULISTA B/C",
    "endereco": "AV PAULISTA",
    "latitude": -23.555883,
    "longitude": -46.66306
  },
  "linha": {
    "codigo": 2506,
    "numero": "8000-1",
    "sentido": 1,
    "origem": "TERM. LAPA",
    "destino": "PÇA. RAMOS DE AZEVEDO"
  },
  "horario_consulta": "2026-10-31T10:00:00-03:00",
  "horario_referencia": "10:00",
  "estado": "sucesso",
  "mensagem_erro": "",
  "previsoes": [
    {
      "horario_previsto": "10:05",
      "veiculo": {
        "prefixo": "81506"
      }
    }
  ]
}
```

**Resposta (200 OK - Sem Previsão):**
```json
{
  "parada": { "codigo": 12345, "nome": "PAULISTA B/C", "endereco": "", "latitude": 0.0, "longitude": 0.0 },
  "linha": { "codigo": 2506, "numero": "8000-1", "sentido": 1, "origem": "", "destino": "" },
  "horario_consulta": "2026-10-31T10:00:00-03:00",
  "horario_referencia": "10:00",
  "estado": "sem_previsao",
  "mensagem_erro": "",
  "previsoes": []
}
```

**Resposta (200 OK - Falha de Comunicação com a SPTrans):**
```json
{
  "parada": { "codigo": 12345, "nome": "PAULISTA B/C", "endereco": "", "latitude": 0.0, "longitude": 0.0 },
  "linha": { "codigo": 2506, "numero": "8000-1", "sentido": 1, "origem": "", "destino": "" },
  "horario_consulta": "2026-10-31T10:00:00-03:00",
  "horario_referencia": "",
  "estado": "falha",
  "mensagem_erro": "O sistema de previsão está indisponível no momento. Tente novamente em instantes.",
  "previsoes": []
}
```

## 5. Formato de Erro Padrão (HTTP 4xx e 5xx)
Quando o backend ou a API externa falham (ex: SPTrans fora do ar, token inválido), a resposta segue este padrão (tratado pelo `main.py`):

**Exemplo (503 Service Unavailable):**
```json
{
  "codigo": "sptrans_indisponivel",
  "mensagem": "SPTrans indisponível no momento. Tente novamente.",
  "tentar_novamente": true
}
```

**Exemplo (502 Bad Gateway):**
```json
{
  "codigo": "erro_sptrans",
  "mensagem": "Erro ao consultar a SPTrans.",
  "tentar_novamente": true
}
```

**Todos os códigos de erro:**

| HTTP | `codigo` | `tentar_novamente` | Quando acontece |
| --- | --- | --- | --- |
| 422 | `requisicao_invalida` | `false` | Parâmetro ausente ou com tipo errado (ex.: `codigo_linha=abc`) |
| 501 | `nao_implementado` | `false` | Funcionalidade ainda não implementada no backend |
| 502 | `erro_autenticacao` | `true` | Token da SPTrans inválido ou ausente |
| 502 | `erro_sptrans` | `true` | Resposta inesperada da SPTrans |
| 503 | `sptrans_indisponivel` | `true` | Timeout, falha de rede ou SPTrans fora do ar |

> `GET /api/previsoes` não usa esses códigos para falhas da SPTrans: responde 200 com `estado: "falha"` e `mensagem_erro` (ver seção 4). Só o 422 se aplica a ela.
