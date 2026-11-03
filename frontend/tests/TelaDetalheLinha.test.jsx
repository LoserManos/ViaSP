import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaDetalheLinha } from '../src/telas/TelaDetalheLinha'
import * as api from '../src/servicos/api'

describe('TelaDetalheLinha (ISS-17 / US06 / US07)', () => {
  const linhaExemplo = {
    codigo: 1001,
    numero: '8012-10',
    sentido: 1,
    origem: 'Cidade Universitária',
    destino: 'Aeroporto Congonhas',
    corBadge: 'vermelha',
  }

  const previsoesExemplo = {
    horario_referencia: '14:30',
    previsoes: [
      {
        horario_previsto: '14:35',
        veiculo: { prefixo: '12345' },
      },
      {
        horario_previsto: '14:48',
        veiculo: { prefixo: '12346' },
      },
    ],
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    api.definirModoMock(true)
  })

  it('renderiza o cabeçalho com número, destino final e sentido da linha (ISS-17.1)', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

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
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={mockVoltar} />)

    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a lista de linhas/i,
    })
    expect(btnVoltar).toBeInTheDocument()
    expect(btnVoltar).toHaveTextContent('Voltar para todas as linhas')

    fireEvent.click(btnVoltar)
    expect(mockVoltar).toHaveBeenCalledTimes(1)
  })

  it('carrega e exibe as previsões de chegada dos próximos veículos', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/Chegada prevista às 14:35/i)).toBeInTheDocument()
      expect(screen.getByText(/Veículo prefixo #12345/i)).toBeInTheDocument()
      expect(screen.getByText(/Chegada prevista às 14:48/i)).toBeInTheDocument()
      expect(screen.getByText('Próximo')).toBeInTheDocument()
      expect(screen.getByText('2º veículo')).toBeInTheDocument()
    })

    expect(api.obterPrevisoes).toHaveBeenCalledWith(1001)
  })

  it('não exibe a seção de paradas principais da rota', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    expect(
      screen.queryByText(/Itinerário e principais paradas da rota/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Parada MASP')).not.toBeInTheDocument()
  })

  it('exibe mensagem de erro com botão de tentar novamente se a busca de previsões falhar', async () => {
    const spy = vi
      .spyOn(api, 'obterPrevisoes')
      .mockRejectedValueOnce({ mensagem: 'Falha ao conectar com o servidor.' })
      .mockResolvedValueOnce(previsoesExemplo)

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

    // Na segunda tentativa, exibe as previsões com sucesso
    await waitFor(() => {
      expect(screen.getByText(/Chegada prevista às 14:35/i)).toBeInTheDocument()
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('exibe mensagem amigável quando a consulta de previsões vier vazia', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue({ previsoes: [] })

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sem previsão no momento')).toBeInTheDocument()
      expect(
        screen.getByText(
          /Não há veículos em circulação informados para esta linha no momento/i
        )
      ).toBeInTheDocument()
    })
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
