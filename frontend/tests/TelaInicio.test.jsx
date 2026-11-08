import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaInicio } from '../src/telas/TelaInicio'
import { listarLinhas, obterTotem, obterPrevisoes } from '../src/servicos/api'

vi.mock('../src/servicos/api', () => ({
  obterTotem: vi.fn(),
  listarLinhas: vi.fn(),
  obterPrevisoes: vi.fn(),
  formatarPrevisao: vi.fn((horarioPrevisto, horarioReferencia) => {
    if (!horarioPrevisto) {
      return {
        minutos: Infinity,
        tempo: 'Sem previsão',
        status: 'Sem previsão',
        ehDestaque: false,
      }
    }
    const [hP, mP] = horarioPrevisto.split(':').map(Number)
    const [hR, mR] = (horarioReferencia || '19:45').split(':').map(Number)
    const minutos = hP * 60 + mP - (hR * 60 + mR)
    return {
      minutos,
      tempo: minutos === 0 ? 'Chegando' : `${minutos} min`,
      status: minutos <= 3 ? 'Chegando' : 'No horário',
      ehDestaque: minutos <= 3,
    }
  }),
}))

describe('TelaInicial alinhada ao protótipo Figma', () => {
  const linhasExemplo = [
    {
      codigo: 1001,
      numero: '8012-10',
      sentido: 1,
      origem: 'Cidade Universitária',
      destino: 'Aeroporto Congonhas',
      corBadge: 'vermelha',
    },
    {
      codigo: 1002,
      numero: '875A-10',
      sentido: 1,
      origem: 'Aeroporto',
      destino: 'Perdizes',
      corBadge: 'azul',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(obterTotem).mockResolvedValue({
      identificador: 'totem-teste',
      parada: {
        codigo: 260015038,
        nome: 'Av. Paulista, 1578',
        endereco: 'Parada MASP — Sentido Consolação',
      },
    })
    vi.mocked(listarLinhas).mockResolvedValue(linhasExemplo)
    vi.mocked(obterPrevisoes).mockImplementation((codigo) => {
      if (codigo === 1001) {
        return Promise.resolve({
          horario_referencia: '19:45',
          estado: 'sucesso',
          previsoes: [
            { horario_previsto: '19:48', veiculo: { prefixo: '12845' } },
          ],
        })
      }
      if (codigo === 1002) {
        return Promise.resolve({
          horario_referencia: '19:45',
          estado: 'sucesso',
          previsoes: [
            { horario_previsto: '19:53', veiculo: { prefixo: '21004' } },
          ],
        })
      }
      return Promise.resolve({
        horario_referencia: '19:45',
        estado: 'sem_previsao',
        previsoes: [],
      })
    })
  })

  it('renderiza os elementos principais da identidade visual do Figma', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    // Tag e Hero
    expect(
      screen.getByText('TRANSPORTE PÚBLICO • SÃO PAULO')
    ).toBeInTheDocument()
    expect(screen.getByText('Olá! Aonde vamos?')).toBeInTheDocument()

    // Campo de busca e botão de voz
    expect(
      screen.getByPlaceholderText('Qual linha você procura?')
    ).toBeInTheDocument()
    expect(screen.getByText('Falar destino')).toBeInTheDocument()

    // Banner de mapa
    expect(screen.getByText('Ver mapa')).toBeInTheDocument()
    expect(
      screen.getByText('Arredores do ponto e localização')
    ).toBeInTheDocument()

    // Cartão unificado do ponto
    expect(await screen.findByText('VOCÊ ESTÁ EM')).toBeInTheDocument()
    expect(screen.getByText('Av. Paulista, 1578')).toBeInTheDocument()
    expect(
      screen.getByText('Parada MASP — Sentido Consolação')
    ).toBeInTheDocument()
    expect(screen.getByText('Atualizado agora')).toBeInTheDocument()

    // Tabela com colunas
    expect(screen.getByText('LINHAS POR CHEGADA')).toBeInTheDocument()
    expect(screen.getByText('TEMPO ESTIMADO')).toBeInTheDocument()
  })

  it('exibe as linhas com tempo estimado e navega ao selecionar', async () => {
    const mockSelecionar = vi.fn()
    render(<TelaInicio aoSelecionarLinha={mockSelecionar} />)

    expect(await screen.findByText('8012-10')).toBeInTheDocument()
    expect(screen.getByText('Aeroporto Congonhas')).toBeInTheDocument()
    expect(screen.getByText('875A-10')).toBeInTheDocument()
    expect(screen.getByText('Perdizes')).toBeInTheDocument()

    // Clica na linha 8012-10
    const btnLinha = screen.getByRole('button', {
      name: /Ver detalhes da linha 8012-10/i,
    })
    fireEvent.click(btnLinha)

    expect(mockSelecionar).toHaveBeenCalledWith(linhasExemplo[0])
  })

  it('calcula e exibe previsões dinâmicas em vez de valores fixos', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    // Linha 8012-10 (prevista para 19:48 com ref 19:45 -> 3 min)
    expect(await screen.findByText('3 min')).toBeInTheDocument()
    expect(screen.getByText('Chegando')).toBeInTheDocument()

    // Linha 875A-10 (prevista para 19:53 com ref 19:45 -> 8 min)
    expect(screen.getByText('8 min')).toBeInTheDocument()
    expect(screen.getByText('No horário')).toBeInTheDocument()
  })

  it('dispara callback ao clicar no banner Ver mapa', () => {
    const mockAbrirMapa = vi.fn()
    render(
      <TelaInicio aoSelecionarLinha={() => {}} aoAbrirMapa={mockAbrirMapa} />
    )

    const bannerMapa = screen.getByRole('button', {
      name: /Ver mapa dos arredores do ponto e localização/i,
    })
    fireEvent.click(bannerMapa)

    expect(mockAbrirMapa).toHaveBeenCalledTimes(1)
  })

  it('exibe mensagem acessível ao clicar no botão Falar destino sem API nativa de voz', () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    const btnVoz = screen.getByRole('button', {
      name: /Falar destino para busca por voz/i,
    })
    fireEvent.click(btnVoz)

    expect(
      screen.getByText(/Busca por voz não suportada neste dispositivo/i)
    ).toBeInTheDocument()
  })

  it('sem busca, avisa que não há ônibus a caminho do ponto agora quando lista for vazia', async () => {
    vi.mocked(listarLinhas).mockResolvedValue([])
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    expect(
      await screen.findByText('Nenhum ônibus a caminho deste ponto agora')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Nenhuma linha encontrada')
    ).not.toBeInTheDocument()
  })

  it('com busca, diz que nenhuma linha foi encontrada e oferece limpar', async () => {
    vi.mocked(listarLinhas).mockResolvedValue([])
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    fireEvent.change(screen.getByLabelText(/buscar linha/i), {
      target: { value: '9999' },
    })

    expect(
      await screen.findByText('Nenhuma linha encontrada')
    ).toBeInTheDocument()
    expect(screen.getByText('Limpar busca')).toBeInTheDocument()
  })

  it('abre e fecha o teclado virtual através do botão de alternância e foco no input (ISS-16.1)', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    // Inicialmente o teclado virtual está fechado
    expect(
      screen.queryByRole('region', { name: /teclado virtual do totem/i })
    ).not.toBeInTheDocument()

    // Clica no botão de alternar teclado
    const btnTeclado = screen.getByRole('button', {
      name: /abrir teclado virtual/i,
    })
    fireEvent.click(btnTeclado)

    expect(
      screen.getByRole('region', { name: /teclado virtual do totem/i })
    ).toBeInTheDocument()

    // Clica novamente para fechar
    fireEvent.click(
      screen.getByRole('button', { name: /ocultar teclado virtual/i })
    )
    expect(
      screen.queryByRole('region', { name: /teclado virtual do totem/i })
    ).not.toBeInTheDocument()

    // Foca no input de busca para reabrir
    const campoBusca = screen.getByLabelText(/buscar linha/i)
    fireEvent.focus(campoBusca)
    expect(
      screen.getByRole('region', { name: /teclado virtual do totem/i })
    ).toBeInTheDocument()

    // Fecha usando o botão 'Ocultar' de dentro do próprio teclado
    fireEvent.click(screen.getByRole('button', { name: /^ocultar teclado$/i }))
    expect(
      screen.queryByRole('region', { name: /teclado virtual do totem/i })
    ).not.toBeInTheDocument()
  })

  it('permite digitar, apagar e limpar busca via teclado virtual (ISS-16.1 / ISS-16.3)', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    const campoBusca = screen.getByLabelText(/buscar linha/i)
    fireEvent.focus(campoBusca)

    // Digita '8', '0', '1', '2'
    fireEvent.click(screen.getByRole('button', { name: 'Tecla 8' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tecla 0' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tecla 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tecla 2' }))

    expect(campoBusca.value).toBe('8012')

    // Apaga o último dígito ('2')
    fireEvent.click(screen.getByRole('button', { name: /apagar caractere/i }))
    expect(campoBusca.value).toBe('801')

    // Limpa toda a busca
    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
    expect(campoBusca.value).toBe('')
  })

  it('fecha o teclado virtual e navega ao selecionar uma linha (ISS-16.3)', async () => {
    const mockSelecionar = vi.fn()
    render(<TelaInicio aoSelecionarLinha={mockSelecionar} />)

    // Abre o teclado virtual
    fireEvent.focus(screen.getByLabelText(/buscar linha/i))
    expect(
      screen.getByRole('region', { name: /teclado virtual do totem/i })
    ).toBeInTheDocument()

    // Seleciona a linha dos resultados
    const btnLinha = await screen.findByRole('button', {
      name: /Ver detalhes da linha 8012-10/i,
    })
    fireEvent.click(btnLinha)

    expect(mockSelecionar).toHaveBeenCalledWith(linhasExemplo[0])
    // O teclado foi automaticamente recolhido para a próxima tela
    expect(
      screen.queryByRole('region', { name: /teclado virtual do totem/i })
    ).not.toBeInTheDocument()
  })
})
