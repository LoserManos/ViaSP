import { Botao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import { LogoViaSP } from '../comuns/LogoViaSP'
import './CabecalhoTotem.css'

/**
 * Cabeçalho unificado do totem para todas as telas.
 *
 * @param {object} props
 * @param {string} [props.nomeParada] - Nome do ponto de ônibus onde o totem está instalado
 *   (vem de `/api/totem`); sem ele, o logo mostra o subtítulo padrão.
 * @param {() => void} [props.aoVoltar] - Se presente, exibe o botão de voltar sempre visível (ISS-14.2).
 * @param {() => void} [props.aoAbrirDemo] - Acessar a tela de demonstração dos tokens.
 * @param {() => void} [props.aoEscolherParada] - Modo dev: abre o mapa para escolher a parada.
 * @param {string} [props.tituloTela] - Título opcional da tela atual.
 */
export function CabecalhoTotem({
  nomeParada,
  aoVoltar,
  aoAbrirDemo,
  aoEscolherParada,
  tituloTela,
  altoContraste = false,
  aoAlternarAltoContraste,
}) {
  return (
    <header className="viasp-cabecalho-totem">
      <div className="viasp-cabecalho-totem__esquerda">
        {aoVoltar ? (
          <Botao
            variante="voltar"
            onClick={aoVoltar}
            ariaLabel="Voltar para a tela anterior"
            className="viasp-cabecalho-totem__btn-voltar"
          >
            Voltar
          </Botao>
        ) : (
          <LogoViaSP
            {...(nomeParada && { subtituloPersonalizado: nomeParada })}
          />
        )}

        {tituloTela && (
          <div className="viasp-cabecalho-totem__titulo-tela">
            <TextoGrande as="h1" variante="subtitulo" peso="bold">
              {tituloTela}
            </TextoGrande>
          </div>
        )}
      </div>

      <div className="viasp-cabecalho-totem__direita">
        {aoAlternarAltoContraste && (
          <button
            type="button"
            onClick={aoAlternarAltoContraste}
            className={`viasp-cabecalho-totem__btn-util ${altoContraste ? 'viasp-cabecalho-totem__btn-util--ativo' : ''}`}
            aria-label="Alternar modo de alto contraste"
            aria-pressed={altoContraste}
          >
            <Icone nome="contraste" />
            <span>Modo de alto contraste</span>
          </button>
        )}

        <div
          className="viasp-cabecalho-totem__idioma"
          aria-label="Idioma: Português do Brasil"
        >
          <span>PT-BR</span>
        </div>

        {aoEscolherParada && (
          <button
            type="button"
            onClick={aoEscolherParada}
            className="viasp-cabecalho-totem__btn-util"
            aria-label="Escolher a parada do totem no mapa (modo dev)"
          >
            <Icone nome="mapa" />
            <span>Escolher parada</span>
          </button>
        )}
        {aoAbrirDemo && (
          <button
            type="button"
            onClick={aoAbrirDemo}
            className="viasp-cabecalho-totem__btn-util"
            aria-label="Abrir guia de design tokens e componentes"
          >
            <Icone nome="paleta" />
            <span>Design Tokens</span>
          </button>
        )}
      </div>
    </header>
  )
}
