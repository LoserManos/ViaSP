import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import L from 'leaflet'
import { TelaMapa } from '../src/telas/TelaMapa'
import * as api from '../src/servicos/api'

describe('TelaMapa — Mapa Real e Linhas Dinâmicas do Backend (ISS-19 / US05 / Figma)', () => {
  const paradaExemplo = {
    codigo: 260015038,
    nome: 'Parada MASP',
    endereco: 'Av. Paulista, 1578 — Bela Vista, São Paulo - SP',
    latitude: -23.561498,
    longitude: -46.655963,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    api.definirModoMock(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza o cabeçalho no padrão do Figma com botão Voltar e nome da parada', () => {
    const mockBack = vi.fn()
    render(<TelaMapa parada={paradaExemplo} onBack={mockBack} />)

    // Cabeçalho
    expect(screen.getByText('Mapa da região')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Parada MASP', level: 2 })
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('Av. Paulista, 1578 — Bela Vista, São Paulo - SP')[0]
    ).toBeInTheDocument()

    // Botão Voltar acessível
    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a tela anterior/i,
    })
    expect(btnVoltar).toBeInTheDocument()
    expect(btnVoltar).toHaveTextContent('Voltar')

    fireEvent.click(btnVoltar)
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('renderiza o mapa Leaflet real com marcador do totem e botão de recentralização', async () => {
    render(<TelaMapa parada={paradaExemplo} onBack={vi.fn()} />)

    // Marcador do totem no Leaflet
    const marcador = await screen.findByTestId('marcador-ponto-onibus')
    expect(marcador).toBeInTheDocument()
    expect(marcador).toHaveTextContent('LOCAL DO TOTEM')
    expect(marcador).toHaveTextContent('Parada MASP')

    // Botão flutuante para recentralizar visão no ponto do totem
    const btnRecentrar = screen.getByRole('button', {
      name: /recentrar visão no ponto do totem/i,
    })
    expect(btnRecentrar).toBeInTheDocument()
    fireEvent.click(btnRecentrar)
  })

  it('carrega as linhas reais da parada e previsões de chegada dinamicamente da API', async () => {
    render(<TelaMapa parada={paradaExemplo} onBack={vi.fn()} />)

    // Aguarda carregar as linhas dinâmicas vindas de listarLinhas()
    await waitFor(() => {
      expect(screen.getByText('Linhas que passam aqui')).toBeInTheDocument()
      const badge8012 = screen.getByText('8012-10')
      expect(badge8012).toBeInTheDocument()
      expect(badge8012).toHaveClass('tela-mapa__linha-badge')
      expect(screen.getByText('875A-10')).toBeInTheDocument()
    })
  })

  it('permite selecionar uma linha real, exibe o botão Ver linha e dispara onOpenLine', async () => {
    const mockOpenLine = vi.fn()
    render(
      <TelaMapa
        parada={paradaExemplo}
        onBack={vi.fn()}
        onOpenLine={mockOpenLine}
      />
    )

    // Aguarda carregar as linhas reais
    const btnLinha = await screen.findByRole('button', { name: /8012-10/i })
    fireEvent.click(btnLinha)

    // Botão "Mostrar todas" e botão de ação para abrir a linha
    expect(screen.getByText('Mostrar todas')).toBeInTheDocument()
    const btnVerLinha = screen.getByRole('button', {
      name: /ver linha 8012-10/i,
    })
    expect(btnVerLinha).toBeInTheDocument()

    fireEvent.click(btnVerLinha)
    expect(mockOpenLine).toHaveBeenCalledTimes(1)
    expect(mockOpenLine).toHaveBeenCalledWith(
      expect.objectContaining({ numero: '8012-10' })
    )

    // Clicar em "Mostrar todas" desmarca a linha
    fireEvent.click(screen.getByText('Mostrar todas'))
    expect(screen.queryByText('Mostrar todas')).not.toBeInTheDocument()
  })

  it('inicia com a linha focada quando initialLine for fornecida', async () => {
    render(
      <TelaMapa
        parada={paradaExemplo}
        initialLine="8012-10"
        onBack={vi.fn()}
        onOpenLine={vi.fn()}
      />
    )

    expect(await screen.findByText('Mostrar todas')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ver linha 8012-10/i })
    ).toBeInTheDocument()
  })

  it('exibe fallback em texto quando os tiles do mapa falharem', async () => {
    let camadaTilesCriada = null
    const tileLayerOriginal = L.tileLayer.bind(L)
    vi.spyOn(L, 'tileLayer').mockImplementation((...args) => {
      camadaTilesCriada = tileLayerOriginal(...args)
      return camadaTilesCriada
    })

    render(<TelaMapa parada={paradaExemplo} onBack={vi.fn()} />)

    expect(
      await screen.findByTestId('marcador-ponto-onibus')
    ).toBeInTheDocument()
    expect(camadaTilesCriada).not.toBeNull()

    act(() => {
      camadaTilesCriada.fire('tileerror', {
        error: new Error('Sem rede para baixar tiles'),
      })
    })

    const fallback = await screen.findByTestId('mapa-ponto-fallback')
    expect(fallback).toBeInTheDocument()
    expect(
      screen.getByText(/Mapa indisponível no momento — localização em texto/i)
    ).toBeInTheDocument()
  })

  it('exibe botão de modo dev quando aoAbrirSeletorDev for fornecido', () => {
    const mockDev = vi.fn()
    render(
      <TelaMapa
        parada={paradaExemplo}
        onBack={vi.fn()}
        aoAbrirSeletorDev={mockDev}
      />
    )

    const btnDev = screen.getByRole('button', {
      name: /trocar parada do totem no modo desenvolvedor/i,
    })
    expect(btnDev).toBeInTheDocument()
    fireEvent.click(btnDev)
    expect(mockDev).toHaveBeenCalledTimes(1)
  })
})
