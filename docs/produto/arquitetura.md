# Definição da Arquitetura Inicial

Este documento descreve a arquitetura do Totem Interativo de Transporte, detalhando os componentes do sistema e o fluxo de dados desde a interação do passageiro até a resposta final na tela.

## 1. Descrição dos Componentes e Fluxo

* **1. Ação do Usuário:** O passageiro, interagindo com o hardware físico na rua, toca na tela para selecionar uma linha ou aciona o microfone.
* **2. Frontend (Cliente):** O aplicativo em React roda em um navegador bloqueado (Modo Quiosque). Ele gerencia o estado visual e, se necessário, utiliza a Web Audio API para capturar pacotes de voz e enviá-los ao servidor.
* **3. Módulo de Inteligência Artificial (Opcional):** Caso a requisição chegue em áudio, o FastAPI delega a transcrição para a API do Whisper e a extração do destino para uma LLM (como OpenAI ou Gemini).
* **4. Armazenamento / Banco de Dados:** O backend registra no banco SQL local/em nuvem as métricas daquela consulta (ex: horário de pico, linha mais buscada, falhas de conexão) para análises operacionais.
* **5. Comunicação com a SPTrans:** O servidor em FastAPI funciona como um orquestrador. Ele mantém uma sessão ativa com a API do Olho Vivo, envia o código da parada e da linha, e recebe as coordenadas dos veículos em trânsito.
* **6. Resposta e Exibição:** O backend consolida e simplifica o JSON da SPTrans e o envia de volta ao React, que atualiza a tela para exibir a informação de forma clara e acessível.

## 2. Diagrama de Fluxo de Dados

O diagrama abaixo ilustra a comunicação em tempo real entre o hardware (Totem), o servidor (Backend) e os provedores de dados externos.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário
    participant F as Frontend (React / Quiosque)
    participant B as Backend (FastAPI)
    participant DB as Banco de Dados (SQL)
    participant IA as API de IA (Whisper/LLM)
    participant SP as SPTrans (Olho Vivo)

    U->>F: Interage via toque ou comando de voz
    F->>B: Envia requisição (Termo de busca ou Áudio WAV)
    
    opt Interação por Voz (Opcional/Could Have)
        B->>IA: Repassa áudio para transcrição (STT)
        IA-->>B: Retorna intenção de rota em texto
    end
    
    B->>DB: Registra log de uso e métricas no banco SQL
    B->>SP: Consulta autenticada de paradas, linhas e previsão
    SP-->>B: Retorna dados em JSON (Posição de GPS e tempos)
    B-->>F: Envia dados processados e limpos
    F-->>U: Atualiza a interface com tempos de chegada (UI)

