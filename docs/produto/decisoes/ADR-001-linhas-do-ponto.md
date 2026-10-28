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