import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '../src/App'
import { definirModoMock } from '../src/servicos/api'

describe('Navegação por Estado no Totem (ISS-14.2)', () => {
  beforeEach(() => {
    definirModoMock(true)
  })

  it('inicia na Tela Inicial exibindo a saudação e a lista de linhas', async () => {
    render(<App />)

    expect(screen.getByText('Olá! Aonde vamos?')).toBeInTheDocument()

    // Aguarda o carregamento das linhas mockadas
    await waitFor(() => {
      expect(screen.getByText(/8012-10/i)).toBeInTheDocument()
    })

    // O cabeçalho mostra a parada vinda de /api/totem, não um nome fixo
    await waitFor(() => {
      expect(
        screen.getByText(/Parada MASP — Av\. Paulista, 1578/)
      ).toBeInTheDocument()
    })

    // Na tela inicial, o botão de voltar não deve estar presente no cabeçalho
    expect(
      screen.queryByRole('button', { name: /voltar para a tela anterior/i })
    ).not.toBeInTheDocument()
  })

  it('navega para a Tela de Detalhes ao tocar em uma linha e exibe o botão de voltar', async () => {
    render(<App />)

    // Aguarda as linhas aparecerem
    await waitFor(() => {
      expect(screen.getByText(/8012-10/i)).toBeInTheDocument()
    })

    // Clica no cartão da linha 8012-10
    const linhaCard = screen.getByRole('button', { name: /8012-10/i })
    fireEvent.click(linhaCard)

    // Verifica que mudou para a tela de detalhes
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /aeroporto congonhas/i })
      ).toBeInTheDocument()
      expect(
        screen.getByText(/próximo ônibus nesta parada/i)
      ).toBeInTheDocument()
      // O cabeçalho com o logo do viaSP e parada atual continua visível
      expect(screen.getByText('SP')).toBeInTheDocument()
      expect(
        screen.getByText(/Parada MASP — Av\. Paulista, 1578/)
      ).toBeInTheDocument()
    })

    // O botão de voltar no cabeçalho foi removido em favor do botão da própria tela de detalhe
    expect(
      screen.queryByRole('button', { name: /voltar para a tela anterior/i })
    ).not.toBeInTheDocument()

    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a lista de linhas/i,
    })
    expect(btnVoltar).toBeInTheDocument()

    // Clica no botão de voltar
    fireEvent.click(btnVoltar)

    // Verifica que retornou para a tela inicial
    await waitFor(() => {
      expect(screen.getByText('Olá! Aonde vamos?')).toBeInTheDocument()
    })
  })

  it('navega para a Tela do Mapa ao tocar no banner de mapa e retorna ao início ao tocar em voltar', async () => {
    render(<App />)

    // Clica no banner "Ver mapa"
    const bannerMapa = await screen.findByRole('button', {
      name: /Ver mapa dos arredores do ponto e localização/i,
    })
    fireEvent.click(bannerMapa)

    // Verifica que mudou para a tela de mapa
    await waitFor(() => {
      expect(screen.getByTestId('secao-mapa-tela')).toBeInTheDocument()
      expect(screen.getByText('Mapa da região')).toBeInTheDocument()
    })

    // Clica no botão de voltar da tela de mapa
    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a tela anterior/i,
    })
    fireEvent.click(btnVoltar)

    // Verifica que voltou para a tela inicial
    await waitFor(() => {
      expect(screen.getByText('Olá! Aonde vamos?')).toBeInTheDocument()
    })
  })

  it('navega da Tela de Detalhes para a Tela do Mapa e retorna para os detalhes ao tocar em voltar', async () => {
    render(<App />)

    // Aguarda e clica em uma linha
    const linhaCard = await screen.findByRole('button', { name: /8012-10/i })
    fireEvent.click(linhaCard)

    // Na tela de detalhes, clica em "Ver linha no mapa"
    const btnVerNoMapa = await screen.findByRole('button', {
      name: /ver linha no mapa/i,
    })
    fireEvent.click(btnVerNoMapa)

    // Verifica que abriu a tela de mapa
    await waitFor(() => {
      expect(screen.getByTestId('secao-mapa-tela')).toBeInTheDocument()
    })

    // Clica no botão de voltar
    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a tela anterior/i,
    })
    fireEvent.click(btnVoltar)

    // Deve retornar para a tela de detalhes da linha
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /aeroporto congonhas/i })
      ).toBeInTheDocument()
    })
  })

  it('não exibe atalhos para design tokens no totem público', async () => {
    render(<App />)

    expect(
      screen.queryByRole('button', {
        name: /abrir guia de design tokens/i,
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /design tokens/i,
      })
    ).not.toBeInTheDocument()
  })
})
