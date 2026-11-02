import { Cartao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import './ItemLinha.css'

/**
 * Item da lista de linhas do ponto (US01 / ISS-15.1): botão grande com
 * número, destino e sentido da linha.
 *
 * @param {object} props
 * @param {{codigo: number, numero: string, origem?: string, destino?: string, corBadge?: string}} props.linha
 * @param {(linha: object) => void} props.aoSelecionar - Disparado ao tocar no item.
 */
export function ItemLinha({ linha, aoSelecionar }) {
  return (
    <Cartao
      onClick={() => aoSelecionar(linha)}
      className="viasp-item-linha"
      ariaLabel={`Ver detalhes da linha ${linha.numero} com destino a ${linha.destino}`}
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
            Sentido: {linha.origem} → {linha.destino}
          </TextoGrande>
        </div>
      </div>

      <Icone nome="avancar" tamanho="2rem" className="viasp-item-linha__seta" />
    </Cartao>
  )
}
