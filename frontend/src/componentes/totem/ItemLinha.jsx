import { TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import './ItemLinha.css'

/**
 * Item da lista de linhas do ponto idêntico ao padrão do Figma.
 *
 * @param {object} props
 * @param {object} props.linha - Objeto da linha.
 * @param {(linha: object) => void} props.aoSelecionar - Disparado ao tocar no item.
 * @param {object} [props.previsao] - Informações de previsão calculadas dinamicamente.
 * @param {number} [props.index=0] - Posição do item na lista.
 */
export function ItemLinha({ linha, aoSelecionar, previsao }) {
  const dados = previsao || linha
  const ehDestaque =
    dados.ehDestaque !== undefined
      ? dados.ehDestaque
      : dados.status === 'Chegando' ||
        (dados.minutos !== undefined && dados.minutos <= 3) ||
        linha.status === 'Chegando'

  const statusTexto =
    dados.status ||
    linha.status ||
    (ehDestaque ? 'Chegando' : dados.tempo || linha.tempo ? 'No horário' : 'Sem previsão')

  const tempoEstimado =
    dados.tempo ||
    linha.tempo ||
    (dados.minutos !== undefined && dados.minutos !== Infinity
      ? `${dados.minutos} min`
      : 'Sem previsão')

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
