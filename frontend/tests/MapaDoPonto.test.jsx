import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import L from 'leaflet'
import { MapaDoPonto } from '../src/componentes/totem/MapaDoPonto'
import App from '../src/App'
import * as api from '../src/servicos/api'

describe('MapaDoPonto — Localização do ponto no mapa (ISS-19 / US05)', () => {
  const paradaMasp = {
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

  it('centra o mapa nas coordenadas de /api/totem com zoom fixo e sem gestos de navegação (ISS-19.2)', async () => {
    const spyMap = vi.spyOn(L, 'map')
    const spyMarker = vi.spyOn(L, 'marker')

    render(<MapaDoPonto />)

    // Aguarda carregar /api/totem e renderizar o marcador grande e legível
    const marcador = await screen.findByTestId('marcador-ponto-onibus')
    expect(marcador).toBeInTheDocument()
    expect(marcador).toHaveTextContent('LOCAL DO TOTEM')
    expect(marcador).toHaveTextContent('Parada MASP')

    // Verifica que o mapa foi inicializado centrado nas coordenadas de /api/totem,
    // com zoom fixo (17) e com todos os gestos que tiram o ponto de vista desabilitados
    expect(spyMap).toHaveBeenCalledTimes(1)
    const opcoesMapa = spyMap.mock.calls[0][1]
    expect(opcoesMapa).toMatchObject({
      center: [paradaMasp.latitude, paradaMasp.longitude],
      zoom: 17,
      minZoom: 17,
      maxZoom: 17,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    })

    // Verifica que o marcador foi posicionado exatamente nas coordenadas da parada
    expect(spyMarker).toHaveBeenCalledWith(
      [paradaMasp.latitude, paradaMasp.longitude],
      expect.objectContaining({
        interactive: false,
        keyboard: false,
      })
    )

    // Exibe também o endereço e as coordenadas na legenda inferior do mapa
    expect(
      screen.getByText(/Av\. Paulista, 1578 — Bela Vista, São Paulo - SP/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/-23\.56150, -46\.65596/)).toBeInTheDocument()
  })

  it('exibe fallback com o endereço em texto quando o carregamento dos tiles falha por rede (ISS-19.3)', async () => {
    let camadaTilesCriada = null
    const tileLayerOriginal = L.tileLayer.bind(L)
    vi.spyOn(L, 'tileLayer').mockImplementation((...args) => {
      camadaTilesCriada = tileLayerOriginal(...args)
      return camadaTilesCriada
    })

    render(<MapaDoPonto parada={paradaMasp} />)

    expect(
      await screen.findByTestId('marcador-ponto-onibus')
    ).toBeInTheDocument()
    expect(camadaTilesCriada).not.toBeNull()

    // Simula falha de rede no carregamento dos blocos (tiles) do OpenStreetMap
    act(() => {
      camadaTilesCriada.fire('tileerror', {
        error: new Error('Falha de rede ao baixar tile'),
      })
    })

    // O mapa cede lugar ao fallback em texto com o endereço claro do ponto
    const fallback = await screen.findByTestId('mapa-ponto-fallback')
    expect(fallback).toBeInTheDocument()
    expect(
      screen.getByText(/Mapa indisponível no momento — localização em texto/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Ponto: Parada MASP/i)).toBeInTheDocument()
    expect(
      screen.getByTestId('mapa-ponto-fallback-endereco')
    ).toHaveTextContent(
      'Endereço: Av. Paulista, 1578 — Bela Vista, São Paulo - SP'
    )

    // Permite tentar recarregar o mapa
    const btnRecarregar = screen.getByRole('button', {
      name: /tentar carregar o mapa novamente/i,
    })
    fireEvent.click(btnRecarregar)

    expect(
      await screen.findByTestId('marcador-ponto-onibus')
    ).toBeInTheDocument()
  })

  it('exibe fallback com o endereço em texto quando a parada não possui coordenadas válidas (0, 0) (ISS-13.3 / ISS-19.3)', () => {
    const paradaSemCoordenadas = {
      codigo: 260015038,
      nome: 'Parada MASP',
      endereco: 'Av. Paulista, 1578 — Bela Vista, São Paulo - SP',
      latitude: 0,
      longitude: 0,
    }

    render(<MapaDoPonto parada={paradaSemCoordenadas} />)

    expect(screen.getByTestId('mapa-ponto-fallback')).toBeInTheDocument()
    expect(
      screen.getByTestId('mapa-ponto-fallback-endereco')
    ).toHaveTextContent(
      'Endereço: Av. Paulista, 1578 — Bela Vista, São Paulo - SP'
    )
    expect(screen.queryByTestId('mapa-ponto-canvas')).not.toBeInTheDocument()
  })

  it('exibe fallback quando a consulta inicial a /api/totem falha por rede (ISS-19.3)', async () => {
    vi.spyOn(api, 'obterTotem').mockRejectedValueOnce(
      new Error('Falha ao consultar /api/totem')
    )

    render(<MapaDoPonto />)

    expect(await screen.findByTestId('mapa-ponto-fallback')).toBeInTheDocument()
    expect(
      screen.getByText(/Mapa indisponível no momento — localização em texto/i)
    ).toBeInTheDocument()
  })

  it('permanece visível continuamente nas telas principais e mantém o totem funcionando se o mapa falhar (Critérios 2 e 3)', async () => {
    let camadaTilesCriada = null
    const tileLayerOriginal = L.tileLayer.bind(L)
    vi.spyOn(L, 'tileLayer').mockImplementation((...args) => {
      camadaTilesCriada = tileLayerOriginal(...args)
      return camadaTilesCriada
    })

    render(<App />)

    // 1. Visível na Tela Inicial
    expect(await screen.findByTestId('secao-mapa-do-ponto')).toBeInTheDocument()
    expect(
      await screen.findByTestId('marcador-ponto-onibus')
    ).toBeInTheDocument()

    // Clica no banner "Ver mapa" na Tela Inicial para ampliar o mapa
    const bannerVerMapa = screen.getByRole('button', {
      name: /Ver mapa dos arredores do ponto e localização/i,
    })
    fireEvent.click(bannerVerMapa)
    expect(screen.getByTestId('secao-mapa-do-ponto')).toHaveClass(
      'viasp-mapa-ponto--expandido'
    )

    // 2. Navega para a Tela de Detalhes de uma linha
    const linhaCard = await screen.findByRole('button', { name: /8012-10/i })
    fireEvent.click(linhaCard)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /aeroporto congonhas/i })
      ).toBeInTheDocument()
    })

    // O mapa permanece visível na Tela de Detalhes da Linha
    expect(screen.getByTestId('secao-mapa-do-ponto')).toBeInTheDocument()
    expect(screen.getByTestId('marcador-ponto-onibus')).toBeInTheDocument()

    // 3. Simula falha de rede no mapa durante o uso da tela de detalhes
    act(() => {
      camadaTilesCriada.fire('tileerror', {
        error: new Error('Sem conexão com servidor de mapas'),
      })
    })

    // O fallback mostra o endereço do ponto em texto e a tela de detalhes continua funcionando
    expect(await screen.findByTestId('mapa-ponto-fallback')).toBeInTheDocument()
    expect(
      screen.getByTestId('mapa-ponto-fallback-endereco')
    ).toHaveTextContent('Av. Paulista, 1578 — Bela Vista, São Paulo - SP')
    expect(screen.getByText(/próximo ônibus nesta parada/i)).toBeInTheDocument()

    // Voltar para a tela inicial continua funcionando normalmente
    fireEvent.click(
      screen.getByRole('button', { name: /voltar para a lista de linhas/i })
    )
    expect(await screen.findByText('Olá! Aonde vamos?')).toBeInTheDocument()
    expect(screen.getByTestId('mapa-ponto-fallback')).toBeInTheDocument()
  })
})
