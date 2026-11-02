import './Icone.css'

/**
 * Traçados dos ícones, copiados do Lucide (https://lucide.dev, licença ISC),
 * v0.460.0. Grade 24×24, contorno em currentColor.
 */
const TRACADOS = {
  // lucide: bus
  onibus: (
    <>
      <path d="M8 6v6" />
      <path d="M15 6v6" />
      <path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  // lucide: search
  busca: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  // lucide: x
  fechar: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  // lucide: triangle-alert
  alerta: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  // lucide: palette
  paleta: (
    <>
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </>
  ),
  // lucide: timer
  cronometro: (
    <>
      <line x1="10" x2="14" y1="2" y2="2" />
      <line x1="12" x2="15" y1="14" y2="11" />
      <circle cx="12" cy="14" r="8" />
    </>
  ),
  // lucide: arrow-left
  voltar: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  // lucide: chevron-right
  avancar: <path d="m9 18 6-6-6-6" />,
}

/**
 * Ícone SVG do totem. O projeto não usa emoji como ícone: a aparência do emoji
 * muda de um sistema para outro e não segue as cores do tema.
 *
 * @param {object} props
 * @param {keyof typeof TRACADOS} props.nome - Qual ícone desenhar.
 * @param {string} [props.tamanho='1em'] - Largura e altura (herda o tamanho do texto por padrão).
 * @param {string} [props.className] - Classes CSS complementares.
 */
export function Icone({ nome, tamanho = '1em', className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`viasp-icone ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      data-icone={nome}
    >
      {TRACADOS[nome]}
    </svg>
  )
}
