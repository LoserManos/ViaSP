import './LogoViaSP.css'

/**
 * Logotipo oficial do ViaSP idêntico ao protótipo do Figma.
 *
 * @param {object} props
 * @param {'pequeno' | 'padrao' | 'grande'} [props.tamanho='padrao'] - Tamanho do logo.
 * @param {boolean} [props.mostrarSubtitulo=true] - Se deve exibir o texto descritivo.
 * @param {string} [props.subtituloPersonalizado] - Texto descritivo opcional (ex: nome da parada).
 */
export function LogoViaSP({
  tamanho = 'padrao',
  mostrarSubtitulo = true,
  subtituloPersonalizado = 'Totem Interativo de Transporte',
}) {
  return (
    <div className={`viasp-logo viasp-logo--${tamanho}`}>
      {/* Ícone oficial fornecido do Figma */}
      <div className="viasp-logo__badge" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
          viewBox="0 0 45 45"
          fill="none"
        >
          <g transform="rotate(-3 22.5 22.5)">
            <path
              d="M14 0h17a14 14 0 0 1 14 14v17a14 14 0 0 1-14 14H4a4 4 0 0 1-4-4V14A14 14 0 0 1 14 0z"
              fill="#E5273F"
            />
            <g
              transform="translate(22.5 22.5) rotate(3) scale(1.125) translate(-12 -12)"
              stroke="#FFFFFF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="18" r="2" />
              <circle cx="18" cy="6" r="2" />
              <path d="M8 18h3a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3" />
            </g>
          </g>
        </svg>
      </div>

      {/* Tipografia da marca: via em preto/chumbo e SP em vermelho */}
      <div className="viasp-logo__texto-area">
        <span className="viasp-logo__nome">
          via<strong className="viasp-logo__sp">SP</strong>
        </span>
        {mostrarSubtitulo && (
          <span className="viasp-logo__subtitulo">
            {subtituloPersonalizado}
          </span>
        )}
      </div>
    </div>
  )
}
