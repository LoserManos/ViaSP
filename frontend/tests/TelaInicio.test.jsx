import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaInicio } from '../src/telas/TelaInicio'
import { listarLinhas, obterTotem } from '../src/servicos/api'

vi.mock('../src/servicos/api', () => ({
  obterTotem: vi.fn(),
  listarLinhas: vi.fn(),
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
})
