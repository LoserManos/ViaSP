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
  // lucide: clock
  relogio: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  // lucide: arrow-left
  voltar: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  // lucide: map-pin
  mapa: (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  // lucide: chevron-right
  avancar: <path d="m9 18 6-6-6-6" />,
  // lucide: contrast / circle-half
  contraste: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 18a6 6 0 0 0 0-12v12z" fill="currentColor" />
    </>
  ),
  // lucide: mic
  microfone: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </>
  ),
  // lucide: globe
  globo: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  // lucide: route
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  // lucide: accessibility
  accessibility: (
    <>
      <circle cx="16" cy="4" r="1" />
      <path d="m18 19 1-7-6 1" />
      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </>
  ),
  // lucide: arrow-left / arrow
  arrow: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  // lucide: keyboard
  teclado: (
    <>
      <path d="M10 8h.01" />
      <path d="M12 12h.01" />
      <path d="M14 8h.01" />
      <path d="M16 12h.01" />
      <path d="M18 8h.01" />
      <path d="M6 8h.01" />
      <path d="M7 16h10" />
      <path d="M8 12h.01" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </>
  ),
  // lucide: delete (backspace)
  apagar: (
    <>
      <path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <path d="m12 9 6 6" />
      <path d="m18 9-6 6" />
    </>
  ),
  // lucide: chevron-down
  recolher: <path d="m6 9 6 6 6-6" />,
}

// Aliases para máxima compatibilidade com componentes existentes
TRACADOS.bus = TRACADOS.onibus
TRACADOS.rota = TRACADOS.route
TRACADOS.acessibilidade = TRACADOS.accessibility
TRACADOS.clock = TRACADOS.relogio
TRACADOS.keyboard = TRACADOS.teclado
TRACADOS.delete = TRACADOS.apagar
TRACADOS.backspace = TRACADOS.apagar

/**
 * Ícone SVG do totem. O projeto não usa emoji como ícone: a aparência do emoji
 * muda de um sistema para outro e não segue as cores do tema.
 *
 * @param {object} props
 * @param {keyof typeof TRACADOS} [props.nome] - Qual ícone desenhar.
 * @param {string} [props.name] - Alias para nome.
 * @param {string | number} [props.tamanho='1em'] - Largura e altura.
 * @param {string | number} [props.size] - Alias para tamanho.
 * @param {string} [props.className] - Classes CSS complementares.
 */
export function Icone({
  nome,
  name,
  tamanho,
  size,
  className = '',
  ...outrasProps
}) {
  const chave = nome || name || 'onibus'
  const dim =
    tamanho || (typeof size === 'number' ? `${size}px` : size) || '1em'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`viasp-icone ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      data-icone={chave}
      {...outrasProps}
    >
      {TRACADOS[chave] || TRACADOS.onibus}
    </svg>
  )
}

// Exporta Icon como alias de Icone
export const Icon = Icone
