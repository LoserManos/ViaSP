import './Icone.css'

/** Traçados dos ícones (grade 24×24, contorno em currentColor). */
const TRACADOS = {
  onibus: (
    <>
      <rect x="4" y="3" width="16" height="15" rx="3" />
      <path d="M4 11h16" />
      <path d="M8 3v8M16 3v8" />
      <circle cx="8" cy="14.5" r="0.75" fill="currentColor" />
      <circle cx="16" cy="14.5" r="0.75" fill="currentColor" />
      <path d="M7 18v2.5M17 18v2.5" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  alerta: (
    <>
      <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
    </>
  ),
  paleta: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.9 1.7-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="7" r="1" fill="currentColor" />
      <circle cx="14.5" cy="7" r="1" fill="currentColor" />
    </>
  ),
  avancar: <path d="m9 5 7 7-7 7" />,
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
