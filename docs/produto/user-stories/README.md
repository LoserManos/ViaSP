# Histórias de Usuário (User Stories)

Este documento centraliza o catálogo completo de **Histórias de Usuário (User Stories)** do Totem de Ponto de Ônibus Inteligente, detalhando os requisitos especificados para a **Entrega 2** a partir do [Backlog Inicial de Funcionalidades](../backlog.md).

---

## 1. Padrão de Especificação

Todas as histórias de usuário deste projeto seguem o modelo padrão ágil:

> **Como** [persona ou papel do usuário]  
> **Quero** [funcionalidade, ação ou necessidade]  
> **Para que** [benefício, valor de negócio ou objetivo alcançado]  

### Critérios de Aceitação e Qualidade
* **Critérios de Aceitação:** Cada história é acompanhada de critérios verificáveis (preferencialmente no formato *Dado / Quando / Então* - Gherkin).
* **Critérios INVEST:** As histórias foram refinadas para serem *Independentes, Negociáveis, Valiosas, Estimáveis, Pequenas (Small) e Testáveis*.
* **Rastreabilidade:** Cada história está vinculada a uma persona identificada nos [Mapas de Empatia](../mapa-de-empatia/mapa-transeunte.md) e a um [Épico do Backlog](../backlog.md).

---

## 2. Personas Consideradas

* **[Arthur](../mapa-de-empatia/mapa-transeunte.md):** Passageiro habitual e com pressa. Prioriza agilidade, previsões em tempo real confiáveis e segurança (evitar sacar o celular no ponto).
* **[Kleber](../mapa-de-empatia/mapa-transeunte-deficiente-visual.md):** Passageiro com deficiência visual. Prioriza autonomia na locomoção, retorno auditivo e comandos acessíveis sem depender de telas visuais.
* **[Fátima](../mapa-de-empatia/mapa-transeunte-idoso.md):** Passageira idosa com baixa familiaridade com smartphones. Prioriza interfaces simples, textos grandes, alto contraste e tempo confortável para ler as informações.

---

## 3. Matriz Geral de Rastreabilidade das Histórias

| ID | Épico | Título da História de Usuário | Persona(s) | Prioridade | Arquivo de Detalhamento |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **US01** | EP01 | Visualização de linhas e sentidos no ponto | Arthur, Fátima | **Must Have** | [ep01-interface.md](./ep01-interface.md) |
| **US02** | EP01 | Busca e seleção de linha | Arthur | **Must Have** | [ep01-interface.md](./ep01-interface.md) |
| **US03** | EP01 | Detalhes do itinerário e pontos principais | Arthur, Turistas | **Must Have** | [ep01-interface.md](./ep01-interface.md) |
| **US04** | EP01 | Retorno automático por inatividade (Timeout) | Sistema / Todos | **Should Have** | [ep01-interface.md](./ep01-interface.md) |
| **US05** | EP02 | Visualização da localização do ponto no mapa | Arthur | **Must Have** | [ep02-previsao.md](./ep02-previsao.md) |
| **US06** | EP02 | Exibição da previsão de chegada dos veículos | Arthur, Fátima | **Must Have** | [ep02-previsao.md](./ep02-previsao.md) |
| **US07** | EP02 | Indicador de última atualização da previsão | Arthur | **Must Have** | [ep02-previsao.md](./ep02-previsao.md) |
| **US08** | EP02 | Notificação de falhas e indisponibilidade de dados | Arthur, Fátima | **Must Have** | [ep02-previsao.md](./ep02-previsao.md) |
| **US09** | EP03 | Modo de alto contraste e tipografia ampliada | Fátima | **Should Have** | [ep03-acessibilidade.md](./ep03-acessibilidade.md) |
| **US10** | EP03 | Navegação não dependente de cores | Fátima, Daltônicos | **Should Have** | [ep03-acessibilidade.md](./ep03-acessibilidade.md) |
| **US11** | EP03 | Leitura sintetizada em áudio das informações | Kleber | **Should Have** | [ep03-acessibilidade.md](./ep03-acessibilidade.md) |
| **US12** | EP03 | Interação por comandos de voz | Kleber | **Could Have** | [ep03-acessibilidade.md](./ep03-acessibilidade.md) |
| **US13** | EP04 | Exibição de pontos de referência da linha | Passageiros / Turistas | **Could Have** | [ep04-rotas.md](./ep04-rotas.md) |
| **US14** | EP04 | Sugestão de linhas por ponto de interesse | Passageiros / Turistas | **Could Have** | [ep04-rotas.md](./ep04-rotas.md) |
| **US15** | EP04 | Planejamento de rotas integradas (multimodal) | Passageiros | **Could Have** | [ep04-rotas.md](./ep04-rotas.md) |

---

## 4. Estrutura dos Arquivos por Épico

O detalhamento de cada história (declaração formal, critérios de aceitação no formato Gherkin e tarefas técnicas) está distribuído nos seguintes documentos:

1. **[Épico 01: Interface & Experiência do Totem (UI/UX)](./ep01-interface.md)**  
   *Engloba US01, US02, US03 e US04.* Foco na ergonomia física do totem, legibilidade e fluxo de navegação touch.
2. **[Épico 02: Previsão e Monitoramento em Tempo Real](./ep02-previsao.md)**  
   *Engloba US05, US06, US07 e US08.* Foco na camada de serviços, integração com a API Olho Vivo da SPTrans e consistência temporal.
3. **[Épico 03: Acessibilidade Universal & Interação por Voz](./ep03-acessibilidade.md)**  
   *Engloba US09, US10, US11 e US12.* Foco em inclusão digital, autonomia de pessoas com deficiência visual e usabilidade para idosos.
4. **[Épico 04: Planejamento e Auxílio de Rotas](./ep04-rotas.md)**  
   *Engloba US13, US14 e US15.* Funcionalidades de conveniência para orientação urbana complementar.
