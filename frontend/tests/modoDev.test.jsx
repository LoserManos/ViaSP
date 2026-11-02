import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { CabecalhoTotem } from '../src/componentes/layout/CabecalhoTotem'
import { escolherParada, listarParadasNaArea } from '../src/servicos/api'

function respostaJson(status, corpo) {
  return Promise.resolve(
    new Response(JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

describe('Modo dev: escolher a parada no mapa', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('o cabeçalho só mostra o botão quando recebe aoEscolherParada', () => {
    const { rerender } = render(<CabecalhoTotem />)
    expect(
      screen.queryByRole('button', { name: /escolher a parada/i })
    ).not.toBeInTheDocument()

    const aoEscolherParada = vi.fn()
    rerender(<CabecalhoTotem aoEscolherParada={aoEscolherParada} />)
    fireEvent.click(screen.getByRole('button', { name: /escolher a parada/i }))
    expect(aoEscolherParada).toHaveBeenCalledTimes(1)
  })

  it('listarParadasNaArea envia a área visível do mapa', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(respostaJson(200, { paradas: [], truncado: false }))

    await listarParadasNaArea({
      latMin: -23.56,
      latMax: -23.55,
      lonMin: -46.67,
      lonMax: -46.65,
    })

    const url = new URL(fetch.mock.calls[0][0], 'http://totem')
    expect(url.pathname).toBe('/api/dev/paradas')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat_min: '-23.56',
      lat_max: '-23.55',
      lon_min: '-46.67',
      lon_max: '-46.65',
      limite: '500',
    })
  })

  it('explica como ligar o modo dev quando o backend responde 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(respostaJson(404, {}))

    await expect(
      listarParadasNaArea({ latMin: 0, latMax: 1, lonMin: 0, lonMax: 1 })
    ).rejects.toMatchObject({ codigo: 'MODO_DEV_DESLIGADO' })
  })

  it('escolherParada faz PUT com o código da parada', async () => {
    const totem = { identificador: 'totem-001', parada: { codigo: 440015007 } }
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(respostaJson(200, totem))

    await expect(escolherParada(440015007)).resolves.toEqual(totem)
    expect(fetch).toHaveBeenCalledWith(
      '/api/dev/parada',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ codigo: 440015007 }),
      })
    )
  })
})
