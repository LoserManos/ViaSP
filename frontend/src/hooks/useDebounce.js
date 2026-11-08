import { useState, useEffect } from 'react'

/**
 * Hook para adiar (debounce) a atualização de um valor.
 *
 * Utilizado na busca de linhas do totem para evitar sobrecarregar
 * o backend com requisições a cada caractere digitado no teclado virtual.
 *
 * @template T
 * @param {T} valor - O valor a ser debounced.
 * @param {number} [atrasoMs=300] - Tempo de espera em milissegundos após a última alteração.
 * @returns {T} O valor atualizado após a pausa de digitação.
 */
export function useDebounce(valor, atrasoMs = 300) {
  const [valorDebounced, setValorDebounced] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => {
      setValorDebounced(valor)
    }, atrasoMs)

    return () => {
      clearTimeout(timer)
    }
  }, [valor, atrasoMs])

  return valorDebounced
}

export default useDebounce
