import './Botao.css'

/**
 * Componente base Botao com alvo de toque ergonomicamente otimizado (mínimo de 64px).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Conteúdo interno do botão.
 * @param {() => void} [props.onClick] - Callback de clique/toque.
 * @param {'primario' | 'secundario' | 'voltar' | 'perigo'} [props.variante='primario'] - Estilo visual.
 * @param {'padrao' | 'grande'} [props.tamanho='padrao'] - Tamanho do botão.
 * @param {boolean} [props.desabilitado=false] - Se está desabilitado.
 * @param {'button' | 'submit' | 'reset'} [props.tipo='button'] - Tipo HTML.
 * @param {string} [props.ariaLabel] - Rótulo de acessibilidade (ARIA).
 * @param {string} [props.className] - Classes adicionais.
 */
export function Botao({
  children,
  onClick,
  variante = 'primario',
  tamanho = 'padrao',
  desabilitado = false,
  tipo = 'button',
  ariaLabel,
  className = '',
  ...outrasProps
}) {
  const classes = [
    'viasp-botao',
    `viasp-botao--${variante}`,
    `viasp-botao--${tamanho}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={tipo}
      className={classes}
      onClick={onClick}
      disabled={desabilitado}
      aria-label={ariaLabel}
      {...outrasProps}
    >
      {variante === 'voltar' && (
        <span className="viasp-botao__icone" aria-hidden="true">
          ←
        </span>
      )}
      <span className="viasp-botao__conteudo">{children}</span>
    </button>
  )
}
