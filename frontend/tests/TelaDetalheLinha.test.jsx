import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaDetalheLinha, LineScreen } from '../src/telas/TelaDetalheLinha'
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
    expect(btnVoltar).toHaveTextContent('Voltar')

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
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText(/Sentido.*às 14:35/i)).toBeInTheDocument()
      expect(screen.getByText('18 min')).toBeInTheDocument()
    })

    expect(api.obterPrevisoes).toHaveBeenCalledWith(1001)
  })

  it('carrega dinamicamente as paradas da linha via listarParadasDaLinha', async () => {
    const mockParadas = [
      { codigo: 1, nome: 'Estação Inicial Teste', access: true },
      { codigo: 2, nome: 'Parada MASP', access: true },
      { codigo: 3, nome: 'Estação Final Teste', access: true },
    ]
    const spyParadas = vi
      .spyOn(api, 'listarParadasDaLinha')
      .mockResolvedValue(mockParadas)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Estação Inicial Teste')).toBeInTheDocument()
      expect(screen.getByText('Parada MASP')).toBeInTheDocument()
      expect(screen.getByText('Estação Final Teste')).toBeInTheDocument()
    })
    expect(spyParadas).toHaveBeenCalledWith(
      1001,
      expect.objectContaining({ numero: '8012-10' })
    )
  })

  it('exibe o diagrama interativo do itinerário com indicação da parada atual (Você está aqui)', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Você está aqui')).toBeInTheDocument()
      expect(screen.getByText('Parada MASP')).toBeInTheDocument()
    })
  })

  it('exibe todas as paradas da linha no diagrama e localiza o totem por código', async () => {
    const mockTotemCustom = {
      identificador: 'TOTEM-01',
      parada: {
        codigo: 440016921,
        nome: 'Av. Paulista, 2027',
      },
    }
    vi.spyOn(api, 'obterTotem').mockResolvedValue(mockTotemCustom)

    const paradasCompletas = [
      { codigo: 101, nome: 'Terminal Origem Real' },
      { codigo: 102, nome: 'Av. Rebouças, 100' },
      { codigo: 440016921, nome: 'Av. Paulista, 2027' },
      { codigo: 103, nome: 'Av. Brigadeiro, 500' },
      { codigo: 104, nome: 'Terminal Destino Real' },
    ]
    vi.spyOn(api, 'listarParadasDaLinha').mockResolvedValue(paradasCompletas)
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('5 paradas · Terminal Origem Real → Aeroporto Congonhas')).toBeInTheDocument()
      expect(screen.getByText('Terminal Origem Real')).toBeInTheDocument()
      expect(screen.getByText('Av. Rebouças, 100')).toBeInTheDocument()
      expect(screen.getByText('Av. Paulista, 2027')).toBeInTheDocument()
      expect(screen.getByText('Av. Brigadeiro, 500')).toBeInTheDocument()
      expect(screen.getByText('Terminal Destino Real')).toBeInTheDocument()
      expect(screen.getByText('Você está aqui')).toBeInTheDocument()
    })
  })

  it('não exibe botões para alternar o sentido da linha', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    expect(
      screen.queryByRole('group', { name: /sentido da linha/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /cidade universitária/i })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /destino: aeroporto congonhas/i })
    ).toBeInTheDocument()
  })

  it('funciona quando chamado como LineScreen com prop code e onMap', async () => {
    const mockBack = vi.fn()
    const mockMap = vi.fn()
    render(<LineScreen code="106A-10" onBack={mockBack} onMap={mockMap} />)

    expect(screen.getByText('106A-10')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /destino: metrô santana/i })
      ).toBeInTheDocument()
      expect(screen.getByText('Você está aqui')).toBeInTheDocument()
    })

    const btnMap = screen.getByRole('button', { name: /ver linha no mapa/i })
    fireEvent.click(btnMap)
    expect(mockMap).toHaveBeenCalledTimes(1)
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
