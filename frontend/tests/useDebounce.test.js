import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '../src/hooks/useDebounce'

describe('Hook: useDebounce (ISS-16.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna o valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('8012', 300))
    expect(result.current).toBe('8012')
  })

  it('atualiza o valor somente após o delay configurado', () => {
    const { result, rerender } = renderHook(
      ({ valor, delay }) => useDebounce(valor, delay),
      { initialProps: { valor: '8', delay: 300 } }
    )

    expect(result.current).toBe('8')

    rerender({ valor: '80', delay: 300 })
    expect(result.current).toBe('8')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    // Ainda não atingiu os 300ms
    expect(result.current).toBe('8')

    rerender({ valor: '801', delay: 300 })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('8')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    // 300ms se passaram desde a última digitação
    expect(result.current).toBe('801')
  })

  it('usa 300ms como delay padrão', () => {
    const { result, rerender } = renderHook(({ valor }) => useDebounce(valor), {
      initialProps: { valor: '702U' },
    })

    rerender({ valor: '702U-10' })
    expect(result.current).toBe('702U')

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe('702U')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('702U-10')
  })
})
