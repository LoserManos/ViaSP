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
