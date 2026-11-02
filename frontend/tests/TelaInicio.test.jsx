import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelaInicio } from '../src/telas/TelaInicio'
import { listarLinhas, obterTotem } from '../src/servicos/api'

vi.mock('../src/servicos/api', () => ({
  obterTotem: vi.fn(),
  listarLinhas: vi.fn(),
}))

describe('Tela inicial: lista vazia (ISS-15.3)', () => {
  beforeEach(() => {
    vi.mocked(obterTotem).mockResolvedValue({
      identificador: 'totem-teste',
      parada: { codigo: 1, nome: 'Parada Teste', endereco: '' },
    })
    vi.mocked(listarLinhas).mockResolvedValue([])
  })

  it('sem busca, avisa que não há ônibus a caminho do ponto agora', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)

    expect(
      await screen.findByText('Nenhum ônibus a caminho deste ponto agora')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Nenhuma linha encontrada')
    ).not.toBeInTheDocument()
  })

  it('com busca, diz que nenhuma linha foi encontrada e oferece limpar', async () => {
    render(<TelaInicio aoSelecionarLinha={() => {}} />)
    fireEvent.change(screen.getByLabelText(/buscar linha/i), {
      target: { value: '9999' },
    })

    expect(
      await screen.findByText('Nenhuma linha encontrada')
    ).toBeInTheDocument()
    // Botão com texto, além do "x" dentro do campo de busca
    expect(screen.getByText('Limpar busca')).toBeInTheDocument()
  })
})
