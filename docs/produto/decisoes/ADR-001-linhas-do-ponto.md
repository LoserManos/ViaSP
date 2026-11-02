# ADR-001: Estratégia de Listagem de Linhas do Ponto

**Data:** 27 de outubro de 2026  
**Status:** Aceito; revisado em 02/11/2026 (Opção (c) substituída pela Opção (a), ver seção 6)  
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
> **Revisada em 02/11/2026:** a decisão vigente é a **Opção (a)**. O texto abaixo registra a decisão original; os motivos da troca estão na seção 6.

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

## 6. Revisão da decisão: Opção (a) (02/11/2026)

### O que aconteceu
A Opção (c) não chegou a ser implementada: o `ServicoConsulta` executava o cruzamento da Opção (b) **a cada requisição** a `/api/linhas`. Contra a API real isso levava mais de 10 s, gerava timeouts e falhas de DNS (resposta 503 no totem) e, quando terminava, devolvia uma lista vazia para a parada `440016921`. Em 01/11/2026 `/api/linhas` passou a usar a Opção (a) como solução provisória.

### Nova decisão
A **Opção (a)** passa a ser a definitiva: `/api/linhas` lista as linhas com ônibus previsto no ponto, via `/Previsao/Parada` (`ClienteSPTrans.buscar_linhas_com_previsao`), com cache em memória de 60 s no `ServicoConsulta`.

### Motivos
- **O que importa ao passageiro é o ônibus que vai chegar.** Uma linha sem nenhum veículo a caminho não ajuda quem está no ponto e, na tela do totem, compete por atenção com as que vão passar. O "contra" da seção 2 (a linha some quando não há ônibus) passa a ser o comportamento desejado.
- **Funciona contra a API real.** Uma requisição por consulta, respondida em menos de 1 s; com o cache, toques seguidos na tela não chegam à SPTrans.
- **Menos peças.** Dispensa o banco de linhas, o agendador semanal e a varredura da Opção (b), que nem encontrava a parada `440016921`.

### Consequências
- Na madrugada, nos fins de semana ou em pontos de linhas que só rodam em dia útil, a lista pode ficar vazia. A tela inicial deve dizer que não há ônibus a caminho do ponto agora, e não que "nenhuma linha foi encontrada".
- Teste em 01/11/2026 às 23:58 (domingo), parada `120010351` (Cidade Universitária): o GTFS da SPTrans lista 11 linhas para o ponto, e `/Previsao/Parada` não devolveu nenhuma: parte delas só roda em dia útil (ex.: 177H-10, 701U-10) e outras passam de hora em hora de madrugada (ex.: 8022-10).
- A ISS-11 (#67) não precisa mais de armazenamento local de linhas nem de sincronização periódica; o cache de 60 s cobre a proteção da API externa para esta rota.
- Nome e coordenadas da parada, que a Olho Vivo não tem para `440016921`, vêm do GTFS da SPTrans (PR #97).
