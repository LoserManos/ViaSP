import './VisualizacaoFigma.css'
import { Botao, Cartao, TextoGrande } from '../base'

/**
 * Componente que recria fielmente a tela inicial do protótipo Figma.
 */
export function VisualizacaoFigma({ onSelecionarLinha }) {
  const linhasExemplo = [
    {
      numero: '8012-10',
      corBadge: 'vermelha',
      destino: 'Aeroporto Congonhas',
      sentido: 'Sentido Centro / Sul',
      tempo: '3 min',
      status: 'Chegando',
      destaque: true,
    },
    {
      numero: '875A-10',
      corBadge: 'azul',
      destino: 'Perdizes',
      sentido: 'Sentido Zona Oeste',
      tempo: '8 min',
      status: 'No horário',
      destaque: false,
    },
    {
      numero: '175P-10',
      corBadge: 'verde',
      destino: 'Metrô Santana',
      sentido: 'Sentido Zona Norte',
      tempo: '14 min',
      status: 'No horário',
      destaque: false,
    },
  ]

  return (
    <div className="viasp-figma-container">
      {/* 1. Barra Superior / Header do Totem */}
      <header className="viasp-figma-header">
        <div className="viasp-figma-header__logo-area">
          <div className="viasp-figma-header__logo-badge">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="3" y="4" width="18" height="15" rx="3" />
              <circle cx="7" cy="15" r="1.5" />
              <circle cx="17" cy="15" r="1.5" />
              <path d="M7 8h10" />
            </svg>
          </div>
          <span className="viasp-figma-header__logo-texto">
            via<strong>SP</strong>
          </span>
          <span className="viasp-figma-header__subtitulo">
            Totem Interativo de Transporte
          </span>
        </div>

        <div className="viasp-figma-header__acoes">
          <button
            type="button"
            className="viasp-figma-header__botao-util"
            aria-label="Ativar alto contraste"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" />
            </svg>
            <span>Alto contraste</span>
          </button>
          <div className="viasp-figma-header__idioma">
            <span>🇧🇷 PT-BR</span>
          </div>
        </div>
      </header>

      {/* 2. Área de Chamada Principal */}
      <div className="viasp-figma-hero">
        <span className="viasp-figma-hero__tag">
          TRANSPORTE PÚBLICO • SÃO PAULO
        </span>
        <TextoGrande as="h1" variante="display">
          Olá! Aonde vamos?
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          Pesquise uma linha ou veja as previsões em tempo real para este ponto
          a seguir:
        </TextoGrande>
      </div>

      {/* 3. Barra de Busca e Botão de Voz */}
      <div className="viasp-figma-busca-row">
        <div className="viasp-figma-busca-input">
          <svg
            className="viasp-figma-busca-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Qual linha você procura?"
            readOnly
            className="viasp-figma-busca-campo"
            aria-label="Qual linha você procura?"
          />
          <button
            type="button"
            className="viasp-figma-busca-btn"
            aria-label="Buscar linha"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <Botao
          variante="primario"
          tamanho="grande"
          className="viasp-figma-btn-voz"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span>Falar destino</span>
        </Botao>
      </div>

      {/* 4. Banner "Ver Mapa" */}
      <div className="viasp-figma-mapa-banner">
        <div className="viasp-figma-mapa-banner__icone">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </div>
        <div className="viasp-figma-mapa-banner__texto">
          <strong>Ver mapa</strong>
          <span>Arredores do ponto e localização</span>
        </div>
        <span className="viasp-figma-mapa-banner__seta">›</span>
      </div>

      {/* 5. Cartão Principal: VOCÊ ESTÁ EM */}
      <Cartao className="viasp-figma-ponto-card">
        <div className="viasp-figma-ponto-card__header">
          <div>
            <div className="viasp-figma-ponto-card__tag">
              <span className="viasp-figma-ponto-card__dot" />
              <span>VOCÊ ESTÁ EM</span>
            </div>
            <TextoGrande as="h2" variante="titulo">
              Av. Paulista, 1578
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Parada MASP — Sentido Consolação
            </TextoGrande>
          </div>

          <div className="viasp-figma-ponto-card__status">
            <span className="viasp-figma-ponto-card__status-dot" />
            <span>Atualizado agora</span>
          </div>
        </div>

        {/* Tabela de Linhas e Chegadas */}
        <div className="viasp-figma-tabela-topo">
          <span>LINHAS POR CHEGADA</span>
          <span>TEMPO ESTIMADO</span>
        </div>

        <div className="viasp-figma-linhas-lista">
          {linhasExemplo.map((linha) => (
            <div
              key={linha.numero}
              className="viasp-figma-linha-item"
              onClick={() => onSelecionarLinha?.(linha)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                (e.key === 'Enter' || e.key === ' ') &&
                onSelecionarLinha?.(linha)
              }
            >
              <div className="viasp-figma-linha-item__esquerda">
                <div
                  className={`viasp-figma-badge viasp-figma-badge--${linha.corBadge}`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <rect x="3" y="4" width="18" height="15" rx="3" />
                    <circle cx="7" cy="15" r="1.5" />
                    <circle cx="17" cy="15" r="1.5" />
                  </svg>
                  <span>{linha.numero}</span>
                </div>
                <div>
                  <TextoGrande variante="destaque" peso="bold">
                    {linha.destino}
                  </TextoGrande>
                  <TextoGrande variante="pequeno" cor="secundario">
                    {linha.sentido}
                  </TextoGrande>
                </div>
              </div>

              <div className="viasp-figma-linha-item__direita">
                <div className="viasp-figma-linha-item__tempo-box">
                  <span
                    className={`viasp-figma-linha-item__status ${linha.destaque ? 'viasp-figma-linha-item__status--alerta' : ''}`}
                  >
                    {linha.status}
                  </span>
                  <span
                    className={`viasp-figma-linha-item__tempo ${linha.destaque ? 'viasp-figma-linha-item__tempo--destaque' : ''}`}
                  >
                    {linha.tempo}
                  </span>
                </div>
                <span className="viasp-figma-linha-item__seta">›</span>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="viasp-figma-ver-todas">
          Ver todas as 12 linhas deste ponto →
        </button>
      </Cartao>
    </div>
  )
}
