import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaDetalheLinha } from '../src/telas/TelaDetalheLinha'
import * as api from '../src/servicos/api'

describe('TelaDetalheLinha (ISS-17 / US03)', () => {
  const linhaExemplo = {
    codigo: 1001,
    numero: '8012-10',
    sentido: 1,
    origem: 'Cidade Universitária',
    destino: 'Aeroporto Congonhas',
    corBadge: 'vermelha',
  }

  const paradasExemplo = [
    {
      codigo: 260015038,
      nome: 'Parada MASP',
      endereco: 'Av. Paulista, 1578',
    },
    {
      codigo: 260015039,
      nome: 'Parada Trianon-Masp',
      endereco: 'Av. Paulista, 1374',
    },
    {
      codigo: 260015045,
      nome: 'Aeroporto de Congonhas (Desembarque)',
      endereco: 'Av. Washington Luís, s/n',
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    api.definirModoMock(true)
  })

  it('renderiza o cabeçalho com número, destino final e sentido da linha (ISS-17.1)', async () => {
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue(paradasExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    // Número no badge
    expect(screen.getByText('8012-10')).toBeInTheDocument()

    // Destino final em destaque
    expect(
      screen.getByRole('heading', { name: /Destino: Aeroporto Congonhas/i })
    ).toBeInTheDocument()

    // Sentido da rota
    expect(
      screen.getByText(/Sentido:\s*Cidade Universitária → Aeroporto Congonhas/i)
    ).toBeInTheDocument()
  })

  it('exibe o botão grande de voltar e dispara aoVoltar quando clicado', async () => {
    const mockVoltar = vi.fn()
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue(paradasExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={mockVoltar} />)

    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a lista de linhas/i,
    })
    expect(btnVoltar).toBeInTheDocument()
    expect(btnVoltar).toHaveTextContent('Voltar para todas as linhas')

    fireEvent.click(btnVoltar)
    expect(mockVoltar).toHaveBeenCalledTimes(1)
  })

  it('carrega e exibe a lista de paradas principais da rota (ISS-17.2)', async () => {
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue(paradasExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    // Aguarda o carregamento das paradas
    await waitFor(() => {
      expect(screen.getByText('Parada MASP')).toBeInTheDocument()
      expect(screen.getByText('Av. Paulista, 1578')).toBeInTheDocument()
      expect(screen.getByText('Parada Trianon-Masp')).toBeInTheDocument()
      expect(
        screen.getByText('Aeroporto de Congonhas (Desembarque)')
      ).toBeInTheDocument()
    })

    // Garante que chamou a API com o código da linha
    expect(api.listarParadasDaLinha).toHaveBeenCalledWith(1001)
  })

  it('é resiliente e exibe o itinerário mesmo se a consulta de previsões falhar', async () => {
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue(paradasExemplo)
    vi.spyOn(api, 'obterPrevisoes').mockRejectedValue({
      mensagem: 'SPTrans indisponível no momento.',
    })

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    // O erro de previsão aparece na seção de previsões
    await waitFor(() => {
      expect(
        screen.getByText(/SPTrans indisponível no momento/i)
      ).toBeInTheDocument()
    })

    // As paradas do itinerário continuam sendo exibidas normalmente
    expect(screen.getByText('Parada MASP')).toBeInTheDocument()
    expect(
      screen.getByText('Aeroporto de Congonhas (Desembarque)')
    ).toBeInTheDocument()
  })

  it('exibe mensagem amigável quando a lista de paradas vier vazia', async () => {
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue([])

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(
        screen.getByText(
          /Nenhuma parada disponível para esta linha no momento/i
        )
      ).toBeInTheDocument()
    })
  })

  it('exibe mensagem de erro com botão de tentar novamente se a busca de paradas falhar', async () => {
    const spy = vi
      .spyOn(api, 'listarParadasDaLinha')
      .mockRejectedValueOnce({ mensagem: 'Falha ao conectar com o servidor.' })
      .mockResolvedValueOnce(paradasExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(
        screen.getByText(/Falha ao conectar com o servidor/i)
      ).toBeInTheDocument()
    })

    // Clica no botão de tentar novamente
    const btnTentar = screen.getByRole('button', {
      name: /tentar.*novamente/i,
    })
    fireEvent.click(btnTentar)

    // Na segunda tentativa, exibe as paradas com sucesso
    await waitFor(() => {
      expect(screen.getByText('Parada MASP')).toBeInTheDocument()
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('trata caso em que nenhuma linha é fornecida exibindo aviso e botão de voltar', () => {
    const mockVoltar = vi.fn()
    render(<TelaDetalheLinha linha={null} aoVoltar={mockVoltar} />)

    expect(screen.getByText('Nenhuma linha selecionada.')).toBeInTheDocument()

    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a lista de linhas/i,
    })
    fireEvent.click(btnVoltar)
    expect(mockVoltar).toHaveBeenCalledTimes(1)
  })
})
