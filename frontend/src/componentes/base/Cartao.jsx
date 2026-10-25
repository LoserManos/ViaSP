import './Cartao.css'

/**
 * Componente base Cartao com suporte a modo informativo ou interativo.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Conteúdo do cartão.
 * @param {() => void} [props.onClick] - Se informado, torna o cartão interativo.
 * @param {boolean} [props.destaque=false] - Se deve ter borda/fundo destacados.
 * @param {string} [props.ariaLabel] - Rótulo de acessibilidade.
 * @param {string} [props.className] - Classes CSS complementares.
 */
export function Cartao({
  children,
  onClick,
  destaque = false,
  ariaLabel,
  className = '',
  ...outrasProps
}) {
  const eClicavel = typeof onClick === 'function'

  const classes = [
    'viasp-cartao',
    eClicavel ? 'viasp-cartao--clicavel' : '',
    destaque ? 'viasp-cartao--destaque' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const handleKeyDown = (evento) => {
    if (eClicavel && (evento.key === 'Enter' || evento.key === ' ')) {
      evento.preventDefault()
      onClick()
    }
  }

  return (
    <div
      className={classes}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={eClicavel ? 'button' : undefined}
      tabIndex={eClicavel ? 0 : undefined}
      aria-label={ariaLabel}
      {...outrasProps}
    >
      {children}
    </div>
  )
}
