import { TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import './ItemLinha.css'

/**
 * Item da lista de linhas do ponto idêntico ao padrão do Figma.
 *
 * @param {object} props
 * @param {object} props.linha - Objeto da linha.
 * @param {(linha: object) => void} props.aoSelecionar - Disparado ao tocar no item.
 * @param {number} [props.index=0] - Posição do item na lista.
 */
export function ItemLinha({ linha, aoSelecionar, index = 0 }) {
  const ehDestaque = index === 0 || linha.status === 'Chegando'
  const statusTexto = linha.status || (index === 0 ? 'Chegando' : 'No horário')
  const tempoEstimado = linha.tempo || `${(index + 1) * 4 - 1} min`

  return (
    <div
      onClick={() => aoSelecionar(linha)}
      className="viasp-item-linha"
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes da linha ${linha.numero} com destino a ${linha.destino}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          aoSelecionar(linha)
        }
      }}
    >
      <div className="viasp-item-linha__esquerda">
        <div
          className={`viasp-item-linha__badge viasp-item-linha__badge--${linha.corBadge || 'azul'}`}
        >
          <Icone nome="onibus" />
          <span>{linha.numero}</span>
        </div>
        <div className="viasp-item-linha__info">
          <TextoGrande variante="destaque" peso="bold">
            {linha.destino}
          </TextoGrande>
          <TextoGrande variante="pequeno" cor="secundario">
            {linha.origem
              ? `Sentido: ${linha.origem} → ${linha.destino}`
              : typeof linha.sentido === 'string'
                ? linha.sentido
                : `Sentido: ${linha.destino}`}
          </TextoGrande>
        </div>
      </div>

      <div className="viasp-item-linha__direita">
        <div className="viasp-item-linha__tempo-box">
          <span
            className={`viasp-item-linha__status ${ehDestaque ? 'viasp-item-linha__status--alerta' : ''}`}
          >
            {statusTexto}
          </span>
          <span
            className={`viasp-item-linha__tempo ${ehDestaque ? 'viasp-item-linha__tempo--destaque' : ''}`}
          >
            {tempoEstimado}
          </span>
        </div>
        <Icone nome="avancar" className="viasp-item-linha__seta" />
      </div>
    </div>
  )
}
