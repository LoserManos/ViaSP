import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Botao, Cartao, TextoGrande } from '../src/componentes/base'
import { TOKENS } from '../src/tokens'

describe('Design Tokens & Ergonomia (ISS-14.4)', () => {
  it('define alvo de toque mínimo de 64 px nos tokens', () => {
    expect(TOKENS.alvoToqueMinimoPx).toBe(64)
  })

  it('possui paleta de alto contraste com cor primária do Figma', () => {
    expect(TOKENS.cores.primaria).toBe('#E5223A')
    expect(TOKENS.cores.textoPrincipal).toBe('#0F172A')
    expect(TOKENS.cores.textoInvertido).toBe('#FFFFFF')
  })
})

describe('Componente: Botao', () => {
  it('renderiza o conteúdo e responde ao clique', () => {
    const handleClick = vi.fn()
    render(<Botao onClick={handleClick}>Consultar Linhas</Botao>)

    const botao = screen.getByRole('button', { name: /consultar linhas/i })
    expect(botao).toBeInTheDocument()

    fireEvent.click(botao)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('aplica as classes de variante e tamanho', () => {
    render(
      <Botao variante="voltar" tamanho="grande">
        Voltar
      </Botao>
    )

    const botao = screen.getByRole('button', { name: /voltar/i })
    expect(botao).toHaveClass('viasp-botao--voltar')
    expect(botao).toHaveClass('viasp-botao--grande')
    expect(screen.getByText('←')).toBeInTheDocument()
  })

  it('respeita o estado desabilitado', () => {
    const handleClick = vi.fn()
    render(
      <Botao desabilitado onClick={handleClick}>
        Desabilitado
      </Botao>
    )

    const botao = screen.getByRole('button', { name: /desabilitado/i })
    expect(botao).toBeDisabled()

    fireEvent.click(botao)
    expect(handleClick).not.toHaveBeenCalled()
  })
})

describe('Componente: Cartao', () => {
  it('renderiza como contêiner estático quando sem onClick', () => {
    const { container } = render(
      <Cartao>
        <p>Conteúdo informativo</p>
      </Cartao>
    )

    const cartao = container.firstChild
    expect(cartao).toHaveClass('viasp-cartao')
    expect(cartao).not.toHaveAttribute('role')
  })

  it('renderiza com papel de botão e responde a clique e tecla Enter quando clicável', () => {
    const handleClick = vi.fn()
    render(
      <Cartao onClick={handleClick} destaque>
        <p>Linha 8012-10</p>
      </Cartao>
    )

    const cartao = screen.getByRole('button')
    expect(cartao).toHaveClass('viasp-cartao--clicavel')
    expect(cartao).toHaveClass('viasp-cartao--destaque')
    expect(cartao).toHaveAttribute('tabIndex', '0')

    fireEvent.click(cartao)
    expect(handleClick).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(cartao, { key: 'Enter' })
    expect(handleClick).toHaveBeenCalledTimes(2)
  })
})

describe('Componente: TextoGrande', () => {
  it('renderiza na tag semântica correta com classe da variante', () => {
    render(
      <TextoGrande as="h1" variante="display" cor="primaria">
        Ponto Butantã
      </TextoGrande>
    )

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('viasp-texto--display')
    expect(heading).toHaveClass('viasp-texto--cor-primaria')
    expect(heading).toHaveTextContent('Ponto Butantã')
  })
})
