import { Botao, TextoGrande } from '../base'
import { LogoViaSP } from '../comuns/LogoViaSP'
import './CabecalhoTotem.css'

/**
 * Cabeçalho unificado do totem para todas as telas.
 *
 * @param {object} props
 * @param {string} [props.nomeParada] - Nome do ponto de ônibus onde o totem está instalado.
 * @param {() => void} [props.aoVoltar] - Se presente, exibe o botão de voltar sempre visível (ISS-14.2).
 * @param {() => void} [props.aoAbrirDemo] - Acessar a tela de demonstração dos tokens.
 * @param {string} [props.tituloTela] - Título opcional da tela atual.
 */
export function CabecalhoTotem({
  nomeParada = 'Parada MASP — Av. Paulista',
  aoVoltar,
  aoAbrirDemo,
  tituloTela,
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
          <LogoViaSP subtituloPersonalizado={nomeParada} />
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
        {aoAbrirDemo && (
          <button
            type="button"
            onClick={aoAbrirDemo}
            className="viasp-cabecalho-totem__btn-util"
            aria-label="Abrir guia de design tokens e componentes"
          >
            <span aria-hidden="true">🎨</span>
            <span>Design Tokens</span>
          </button>
        )}
      </div>
    </header>
  )
}
