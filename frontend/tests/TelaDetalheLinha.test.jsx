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
      expect(
        screen.getByText('Próximo ônibus nesta parada')
      ).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText(/Sentido.*às 14:35/i)).toBeInTheDocument()
      expect(screen.getByText('Depois')).toBeInTheDocument()
      expect(screen.getByText('18 min')).toBeInTheDocument()
      expect(screen.getByText('14:48')).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/veículos em circulação/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/prefixo/i)).not.toBeInTheDocument()
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
      expect(
        screen.getByText(
          '5 paradas · Terminal Origem Real → Aeroporto Congonhas'
        )
      ).toBeInTheDocument()
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
      expect(screen.getByText(/14:35/i)).toBeInTheDocument()
    })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('exibe Sem previsão no momento quando a consulta de previsões vier vazia (ISS-18.1)', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue({ previsoes: [] })

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sem previsão no momento')).toBeInTheDocument()
    })
    expect(
      screen.queryByText(/veículos em circulação/i)
    ).not.toBeInTheDocument()
  })

  it('atualiza as previsões automaticamente via polling periódico (ISS-18.2)', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(api, 'obterPrevisoes')
      .mockResolvedValue(previsoesExemplo)

    render(
      <TelaDetalheLinha
        linha={linhaExemplo}
        aoVoltar={vi.fn()}
        intervaloPollingMs={10000}
      />
    )

    // Chamada inicial
    expect(spy).toHaveBeenCalledTimes(1)

    // Avança 10 segundos -> segundo ciclo de polling
    await vi.advanceTimersByTimeAsync(10000)
    expect(spy).toHaveBeenCalledTimes(2)

    // Avança mais 10 segundos -> terceiro ciclo de polling
    await vi.advanceTimersByTimeAsync(10000)
    expect(spy).toHaveBeenCalledTimes(3)

    vi.useRealTimers()
  })

  it('cancela o polling ao desmontar a tela (ISS-18.2)', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(api, 'obterPrevisoes')
      .mockResolvedValue(previsoesExemplo)

    const { unmount } = render(
      <TelaDetalheLinha
        linha={linhaExemplo}
        aoVoltar={vi.fn()}
        intervaloPollingMs={10000}
      />
    )

    expect(spy).toHaveBeenCalledTimes(1)

    // Desmonta a tela (usuário voltou para a tela inicial)
    unmount()

    // Avança 30 segundos no tempo
    await vi.advanceTimersByTimeAsync(30000)

    // Nenhuma chamada adicional deve ter ocorrido
    expect(spy).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('executa contagem regressiva local diminuindo os minutos sem nova chamada e corrigindo na resposta (ISS-18.3)', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(api, 'obterPrevisoes')
      .mockResolvedValueOnce(previsoesExemplo)
      .mockResolvedValueOnce({
        horario_referencia: '14:32',
        previsoes: [
          {
            horario_previsto: '14:38',
            veiculo: { prefixo: '12345' },
          },
        ],
      })

    // Intervalo de polling de 5 minutos para isolar a contagem regressiva
    render(
      <TelaDetalheLinha
        linha={linhaExemplo}
        aoVoltar={vi.fn()}
        intervaloPollingMs={300000}
      />
    )

    // Aguarda a resolução da promessa inicial
    await vi.advanceTimersByTimeAsync(50)

    // Valor inicial com base em 14:35 - 14:30 = 5 min
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // Avança 60 segundos -> 1 minuto decorrido localmente
    await vi.advanceTimersByTimeAsync(60000)

    // O tempo diminuiu para 4 min sem nova chamada da API
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // Avança mais 60 segundos -> 2 minutos decorridos localmente
    await vi.advanceTimersByTimeAsync(60000)

    // O tempo diminuiu para 3 min sem nova chamada da API
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // Avança até o próximo ciclo de polling (faltam 180s para completar 300s)
    await vi.advanceTimersByTimeAsync(180000)
    expect(spy).toHaveBeenCalledTimes(2)

    // O valor foi corrigido com a nova resposta da API: 14:38 - 14:32 = 6 min
    expect(screen.getByText('6')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('mantém contagem regressiva ativa mesmo com ciclos de polling a cada 30s que retornam os mesmos horários (ISS-18.3)', async () => {
    vi.useFakeTimers()
    const spy = vi
      .spyOn(api, 'obterPrevisoes')
      .mockResolvedValue(previsoesExemplo)

    render(
      <TelaDetalheLinha
        linha={linhaExemplo}
        aoVoltar={vi.fn()}
        intervaloPollingMs={30000}
      />
    )

    await vi.advanceTimersByTimeAsync(50)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(spy).toHaveBeenCalledTimes(1)

    // Avança 30 segundos: polling roda e retorna o mesmo payload
    await vi.advanceTimersByTimeAsync(30000)
    expect(spy).toHaveBeenCalledTimes(2)

    // Avança mais 30 segundos (total 60s): deve decrementar para 4 min localmente
    await vi.advanceTimersByTimeAsync(30000)
    expect(screen.getByText('4')).toBeInTheDocument()

    // Avança mais 60 segundos (total 120s): deve decrementar para 3 min localmente
    await vi.advanceTimersByTimeAsync(60000)
    expect(screen.getByText('3')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('exibe o horário de referência da última atualização na interface (ISS-18.4)', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      expect(
        screen.getAllByText(/Atualizado às 14:30/i).length
      ).toBeGreaterThanOrEqual(1)
    })
  })

  it('exibe alerta de previsão desatualizada quando o payload indicar desatualizado=true (ISS-18.4)', async () => {
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue({
      ...previsoesExemplo,
      desatualizado: true,
    })

    render(<TelaDetalheLinha linha={linhaExemplo} aoVoltar={vi.fn()} />)

    await waitFor(() => {
      const alerta = screen.getByRole('alert')
      expect(alerta).toBeInTheDocument()
      expect(alerta).toHaveTextContent(/Previsão desatualizada/i)
      expect(alerta).toHaveTextContent(/não refletir o momento real/i)
    })
  })

  it('exibe alerta de previsão desatualizada quando o tempo sem atualização ultrapassar o limite (ISS-18.4)', async () => {
    vi.useFakeTimers()
    vi.spyOn(api, 'obterPrevisoes').mockResolvedValue(previsoesExemplo)

    render(
      <TelaDetalheLinha
        linha={linhaExemplo}
        aoVoltar={vi.fn()}
        intervaloPollingMs={0}
        limiteDesatualizadoMs={60000}
      />
    )

    await vi.advanceTimersByTimeAsync(50)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // Avança 61 segundos (passa do limite de 60s)
    await vi.advanceTimersByTimeAsync(61000)

    const alerta = screen.getByRole('alert')
    expect(alerta).toBeInTheDocument()
    expect(alerta).toHaveTextContent(/Previsão desatualizada/i)

    vi.useRealTimers()
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
