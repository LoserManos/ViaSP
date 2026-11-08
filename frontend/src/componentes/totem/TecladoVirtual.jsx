import PropTypes from 'prop-types'
import { Icone } from '../comuns/Icone'
import './TecladoVirtual.css'

const LINHAS_TECLAS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-'],
]

/**
 * Teclado Virtual para Totem Público (ISS-16.1 / US02).
 *
 * Projetado para interação tátil em modo quiosque:
 * - Alvos de toque ergonômicos (>= 64px de altura, WCAG AA).
 * - Números e letras visíveis simultaneamente (sem troca de modo).
 * - Ações claras: Limpar, Espaço, Apagar e Ocultar.
 *
 * @param {object} props
 * @param {(caractere: string) => void} props.aoDigitar - Chamado ao tocar numa tecla alfanumérica/espaço.
 * @param {() => void} props.aoApagar - Chamado ao tocar na tecla de backspace.
 * @param {() => void} props.aoLimpar - Chamado ao tocar no botão de limpar.
 * @param {() => void} props.aoFechar - Chamado para recolher/ocultar o teclado.
 * @param {string} [props.className] - Classes CSS extras.
 */
export function TecladoVirtual({
  aoDigitar,
  aoApagar,
  aoLimpar,
  aoFechar,
  className = '',
}) {
  const lidarComMouseDown = (e) => {
    // Evita perda de foco no campo de busca ao clicar no teclado virtual
    e.preventDefault()
  }

  return (
    <section
      className={`viasp-teclado ${className}`.trim()}
      aria-label="Teclado virtual do totem"
      role="region"
    >
      <div className="viasp-teclado__linhas">
        {LINHAS_TECLAS.map((linha, indiceLinha) => (
          <div key={indiceLinha} className="viasp-teclado__linha">
            {linha.map((tecla) => (
              <button
                key={tecla}
                type="button"
                className="viasp-teclado__tecla viasp-teclado__tecla--caractere"
                onClick={() => aoDigitar(tecla)}
                onMouseDown={lidarComMouseDown}
                aria-label={`Tecla ${tecla}`}
              >
                {tecla}
              </button>
            ))}
          </div>
        ))}

        {/* Linha 5: Ações principais */}
        <div className="viasp-teclado__linha viasp-teclado__linha--acoes">
          <button
            type="button"
            className="viasp-teclado__tecla viasp-teclado__tecla--acao viasp-teclado__tecla--limpar"
            onClick={aoLimpar}
            onMouseDown={lidarComMouseDown}
            aria-label="Limpar busca"
          >
            Limpar
          </button>

          <button
            type="button"
            className="viasp-teclado__tecla viasp-teclado__tecla--espaco"
            onClick={() => aoDigitar(' ')}
            onMouseDown={lidarComMouseDown}
            aria-label="Espaço"
          >
            Espaço
          </button>

          <button
            type="button"
            className="viasp-teclado__tecla viasp-teclado__tecla--acao viasp-teclado__tecla--apagar"
            onClick={aoApagar}
            onMouseDown={lidarComMouseDown}
            aria-label="Apagar caractere"
          >
            <Icone nome="apagar" tamanho="1.35rem" />
            <span>Apagar</span>
          </button>

          <button
            type="button"
            className="viasp-teclado__tecla viasp-teclado__tecla--acao viasp-teclado__tecla--fechar"
            onClick={aoFechar}
            onMouseDown={lidarComMouseDown}
            aria-label="Ocultar teclado"
          >
            <Icone nome="recolher" tamanho="1.35rem" />
            <span>Ocultar</span>
          </button>
        </div>
      </div>
    </section>
  )
}

TecladoVirtual.propTypes = {
  aoDigitar: PropTypes.func.isRequired,
  aoApagar: PropTypes.func.isRequired,
  aoLimpar: PropTypes.func.isRequired,
  aoFechar: PropTypes.func.isRequired,
  className: PropTypes.string,
}

export default TecladoVirtual
