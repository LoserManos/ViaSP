# ADR-001: Estratégia de Listagem de Linhas do Ponto

**Data:** 27 de outubro de 2026  
**Status:** Aceito  
**Contexto:** Tarefa ISS-03.3 (US01 - Exibir linhas disponíveis no totem)

## 1. Contexto e Problema
A tela inicial do totem precisa listar todas as linhas que passam no ponto físico configurado (Av. Paulista, código `440016921`). Como a API da SPTrans não possui rota direta do tipo `/Parada/{id}/Linhas`, precisamos definir como o backend vai estruturar e entregar essa lista ao frontend sem introduzir latência na interface.

## 2. Opções Analisadas

**Opção (a): Bater em `/Previsao/Parada` em tempo real**
- **Prós:** Resolve a consulta com apenas uma requisição HTTP.
- **Contras:** Se não houver ônibus circulando no horário da requisição (madrugada, recolhimento de frota ou falha de sinal), a linha sequer é listada no JSON (cenário validado nas fixtures `previsao_parada_nula.json` e `previsao.json`).
- **Consequência:** A linha desaparece da tela inicial, induzindo o passageiro ao erro de achar que a linha foi extinta.

**Opção (b): Cruzar `/Linha/Buscar` com `/BuscarParadasPorLinha` sob demanda**
- **Prós:** Informação sempre sincronizada com o cadastro da SPTrans.
- **Contras:** Exige dezenas de chamadas encadeadas por consulta. Embora os testes mostrem que a API tolera 20 requisições simultâneas sem cair, executar essa varredura sob demanda a cada carregamento de tela sobrecarrega a rede e cria risco iminente de bloqueio por rate limiting (HTTP 429).

**Opção (c): Lista local com atualização semanal em background**
- O backend mantém a relação de linhas em banco local (cache). Um job em background roda semanalmente na madrugada (ex: domingo às 3h), executa o cruzamento da Opção (b) contra a API da SPTrans e atualiza a base estática do totem.

## 3. Decisão
Escolhemos a **Opção (c)**. O backend entregará as linhas cadastradas diretamente do armazenamento local, com sincronização semanal automatizada via worker em background.

## 4. Consequências e Trade-offs
- **UX consistente:** A linha sempre aparece na tela, com ou sem veículos ativos no radar de GPS no instante da consulta.
- **Resiliência operacional:** O totem continua exibindo a malha de linhas mesmo em momentos de indisponibilidade da API externa.
- **Complexidade adicional:** Exige a configuração de um agendador de tarefas no FastAPI (ex: APScheduler) para orquestrar a rotina semanal.
- **Defasagem tolerada:** Alterações de itinerário ocorridas ao longo da semana levarão até 7 dias para refletir no totem, margem considerada aceitável para o domínio de transporte público.

---

## 5. Limites Observados da API SPTrans (Olho Vivo)

Os parâmetros a seguir foram validados empiricamente através dos testes de carga e monitoramento do endpoint:

### 5.1 Autenticação e Sessão (TTL)
- **Status:** Autenticação via POST retornando `true` e gravando cookie de sessão.
- **Duração do Cookie:** Exatamente 30 minutos.
- **Comportamento pós-expiração:** Status HTTP `401 Unauthorized` com payload `{"Message":"Authorization has been denied for this request."}`.
- **Mitigação:** Implementar worker com renovação proativa a cada 25 minutos ou interceptor de requisição com *retry* automático ao receber 401.

### 5.2 Latência (Amostra de 20 requisições sequenciais)
- **Tempo Médio:** 0.050s
- **Tempo Mínimo:** 0.034s
- **Tempo Máximo:** 0.114s
- **Status HTTP:** 200

### 5.3 Concorrência e Rate Limiting (20 requisições simultâneas)
- **Taxa de Sucesso:** 100% (20 respostas HTTP 200).
- **Comportamento:** A API suportou rajadas concorrentes sem emissão de `429 Too Many Requests`.

### 5.4 Tratamento de Erros e Tipagem
- **Parâmetro inválido (String em campo numérico de parada):** Status HTTP `400 Bad Request` com corpo `{"Message":"The request is invalid."}`.
- **Chamada não autenticada:** Status HTTP `401 Unauthorized`.

## 6. Solução provisória (01/11/2026)

A Opção (c) ainda não foi implementada: o `ServicoConsulta` executava o cruzamento da Opção (b) **a cada requisição** a `/api/linhas`. Contra a API real isso levava mais de 10 s, gerava timeouts e falhas de DNS (resposta 503 no totem) e, quando terminava, devolvia uma lista vazia para a parada `440016921`.

Até a Opção (c) existir, `/api/linhas` usa a **Opção (a)** (`ClienteSPTrans.buscar_linhas_com_previsao`, sobre `/Previsao/Parada`), com cache em memória de 60 s no `ServicoConsulta`. Responde em menos de 1 s, mas **linhas sem ônibus previsto no momento não aparecem**, a consequência descrita na seção 2.

Pendências para cumprir a decisão original:
- Implementar o armazenamento local e a sincronização periódica (pode ser feito junto com a ISS-11).
- Investigar por que o cruzamento de `buscar_linhas_da_parada` não encontra a parada `440016921`. O mesmo vale para `Parada/Buscar`: o nome e as coordenadas da parada vêm vazios em `/api/totem`.
