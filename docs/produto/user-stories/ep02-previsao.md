

# Histórias de Usuário - Épico 02 (Previsão e Monitoramento em Tempo Real)

## US05: Visualizacao da localizacao do ponto no mapa
* **Personagem:** Arthur
* **Declaração:** Ao chegar no ponto, gostaria de visualizar onde estou, por meio de um mapa dos meus arredores.
* **Contexto de uso:** O sistema opera em um totem público físico, e para que as rotas e linhas facam sentido, e necessario saber a localizacao do ponto.
* **Critérios de Aceitação:** 
  * Visualicao clara da posicao do ponto no mapa.
  * Exibicao continua dessa informacao.
* **Prioridade:** Must Have.

## US06: Exibir a previsão de chegada dos próximos ônibus* **Personagem:** Fatima
* **Declaração:** Gostaria de saber o horario em que os proximos onibus irao chegar no ponto.
* **Contexto de uso:** O sistema opera em um totem público físico, uma informacao tao demandada como esta deve ser transmitida com clareza e acertividade.
* **Critérios de Aceitação:** 
  * Visualicao clara das previsoes de chegada dos próximos ônibus.
  * Exibicao continua dessa informacao.
* **Prioridade:** Must Have.

## US07: Informar o horário da última atualização da previsão
* **Personagem:** Arthur
* **Declaração:** Ao olhar as previsoes de chegada dos onibus, gostaria de saber se a informacao exibida esta devidamente atualizada.
* **Contexto de uso:** O totem exibe uma listagem das proximas paradas dos onibus nas linhas disponiveis no ponto, isso por meio de comunicacao com API da SPTrans.
* **Critérios de Aceitação:** 
  * Visualicao clara da informacao em questao.
* **Prioridade:** Must Have.

## US08: Informar falhas ou indisponibilidade dos dados e permitir nova tentativa.
* **Personagem:** Arthur
* **Declaração:** Ao consultar uma informacao (Linha, rota, etc), caso ocorra algum erro, quero receber feedback para entender a situacao e poder tentar novamente.
* **Contexto de uso:** O sistema possui I/O, logo esta sujeito a varias falhas. Para tornar a experiencia agradavel e calma, deve ser comunicativo acerca de erros, e oferecer possibilidade de novas tentativas.
* **Critérios de Aceitação:** 
  * Cobertura das possiveis falhas de comunicacao.
  * Clareza nas mensagens de erro.
* **Prioridade:** Must Have.
