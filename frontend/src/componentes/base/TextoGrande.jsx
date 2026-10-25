import './TextoGrande.css'

/**
 * Componente tipográfico de alta legibilidade para totem público.
 *
 * @param {object} props
 * @param {'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'} [props.as='p'] - Tag HTML semântica.
 * @param {'display' | 'titulo' | 'subtitulo' | 'destaque' | 'corpo' | 'pequeno'} [props.variante='corpo'] - Escala tipográfica.
 * @param {'padrao' | 'secundario' | 'invertido' | 'primaria' | 'sucesso' | 'alerta' | 'erro'} [props.cor='padrao'] - Cor do texto.
 * @param {'regular' | 'medio' | 'semibold' | 'bold'} [props.peso] - Peso da fonte opcional.
 * @param {React.ReactNode} props.children - Conteúdo do texto.
 * @param {string} [props.className] - Classes CSS adicionais.
 */
export function TextoGrande({
  as: Componente = 'p',
  variante = 'corpo',
  cor = 'padrao',
  peso,
  children,
  className = '',
  ...outrasProps
}) {
  const classes = [
    'viasp-texto',
    `viasp-texto--${variante}`,
    `viasp-texto--cor-${cor}`,
    peso ? `viasp-texto--peso-${peso}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Componente className={classes} {...outrasProps}>
      {children}
    </Componente>
  )
}
