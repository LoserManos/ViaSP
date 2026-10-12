# Definição de Tecnologias

Este documento estabelece a base tecnológica para o desenvolvimento do Totem Interativo de Transporte, abrangendo o ecossistema de front-end, back-end, testes e integrações externas.

## 1. Stack Base de Desenvolvimento

### Backend
* **Python:** Linguagem principal do servidor, escolhida por sua vasta biblioteca para processamento de dados e IA.
* **FastAPI:** Framework web assíncrono de alta performance. Essencial para não bloquear o servidor enquanto aguarda as respostas das APIs de trânsito e de processamento de linguagem natural.
* **Pytest:** Framework utilizado para a criação de rotinas de testes automatizados, garantindo a confiabilidade dos endpoints e regras de negócio.
* **SQLite:** Banco de dados relacional leve e embutido. Será utilizado para armazenar localmente as configurações de inicialização do totem (como o ID do ponto de ônibus onde ele está instalado) e logs de uso diário sem exigir infraestrutura de banco em nuvem.

### Frontend
* **React / Javascript:** Biblioteca principal para a construção da interface de usuário do totem, permitindo uma atualização reativa dos componentes (como a contagem regressiva dos ônibus) sem recarregar a página.
* **Web Audio API:** Interface nativa dos navegadores utilizada para capturar o áudio do usuário diretamente pelo microfone do hardware.

### Ambiente de Execução (Hardware)
* **Navegador em Modo Quiosque (Kiosk Mode):** A aplicação web rodará em um sistema operacional bloqueado, exibindo o frontend em tela cheia. Este modo impede que os transeuntes minimizem a tela, acessem o desktop do totem ou naveguem para outras URLs.

## 2. Integrações e APIs Externas

As funcionalidades que dependem de dados do mundo real serão alimentadas pelas seguintes APIs:

* **API de Transporte - Olho Vivo (SPTrans):**
  * **Função:** Fonte de dados oficial e gratuita da cidade de São Paulo.
  * **Uso:** Fornece o mapeamento de rotas, os pontos de parada e a posição via GPS da frota de ônibus em tempo real (endpoint de Previsão), garantindo a informação exata de quantos minutos faltam para a chegada do veículo.

* **APIs de Interação por Voz (Speech-to-Text e LLM):**
  * **Função:** Compreensão de linguagem natural. Esta feature é uma pretensão do grupo, sem garantias de implementação no MVP.
  * **Uso:** Uma API de Speech-to-Text será utilizada para captar a gravação de áudio do usuário no ponto, enquanto uma LLM (como a OpenAI ou Gemini) fará a interpretação das intenções de rotas com base na fala transcrita.