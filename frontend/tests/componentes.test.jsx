import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Botao, Cartao, TextoGrande } from '../src/componentes/base'
import { CabecalhoTotem } from '../src/componentes/layout/CabecalhoTotem'
import { RodapeTotem } from '../src/componentes/layout/RodapeTotem'
import { ItemLinha } from '../src/componentes/totem/ItemLinha'
import { Icone } from '../src/componentes/comuns/Icone'
import { TOKENS } from '../src/tokens'

describe('Design Tokens & Ergonomia (ISS-14.4)', () => {
  it('define alvo de toque mínimo de 64 px nos tokens', () => {
    expect(TOKENS.alvoToqueMinimoPx).toBe(64)
  })

  it('possui paleta de alto contraste com cor primária do Figma', () => {
    expect(TOKENS.cores.primaria).toBe('#E5273F')
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
    expect(botao.querySelector('svg[data-icone="voltar"]')).not.toBeNull()
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

describe('Componente: ItemLinha (ISS-15.1)', () => {
  const linha = {
    codigo: 1001,
    numero: '8012-10',
    origem: 'Cidade Universitária',
    destino: 'Aeroporto Congonhas',
  }

  it('mostra número, destino e sentido da linha', () => {
    render(<ItemLinha linha={linha} aoSelecionar={() => {}} />)

    expect(screen.getByText('8012-10')).toBeInTheDocument()
    expect(screen.getByText('Aeroporto Congonhas')).toBeInTheDocument()
    expect(
      screen.getByText('Sentido: Cidade Universitária → Aeroporto Congonhas')
    ).toBeInTheDocument()
  })

  it('usa ícone SVG em vez de emoji', () => {
    const { container } = render(
      <ItemLinha linha={linha} aoSelecionar={() => {}} />
    )

    expect(container.querySelector('svg[data-icone="onibus"]')).not.toBeNull()
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('devolve a linha ao ser tocado', () => {
    const aoSelecionar = vi.fn()
    render(<ItemLinha linha={linha} aoSelecionar={aoSelecionar} />)

    fireEvent.click(screen.getByRole('button', { name: /8012-10/ }))
    expect(aoSelecionar).toHaveBeenCalledWith(linha)
  })

  it('exibe origem → destino mesmo quando linha.sentido for um número (evita exibir o dígito 2)', () => {
    const linhaComSentidoNumerico = {
      codigo: 1004,
      numero: '917H-10',
      sentido: 2,
      origem: 'Terminal Sacomã',
      destino: 'Terminal Pirituba',
    }
    render(
      <ItemLinha linha={linhaComSentidoNumerico} aoSelecionar={() => {}} />
    )

    expect(
      screen.getByText('Sentido: Terminal Sacomã → Terminal Pirituba')
    ).toBeInTheDocument()
    // Garante que o número 2 do sentido não é exibido isolado
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument()
  })
})

describe('Componente: CabecalhoTotem', () => {
  it('exibe o nome da parada e botão de voltar quando fornecido', () => {
    const mockVoltar = vi.fn()
    render(<CabecalhoTotem nomeParada="Parada MASP" aoVoltar={mockVoltar} />)

    expect(screen.getByText(/Parada MASP/i)).toBeInTheDocument()
    const btnVoltar = screen.getByRole('button', {
      name: /voltar para a tela anterior/i,
    })
    expect(btnVoltar).toBeInTheDocument()
    fireEvent.click(btnVoltar)
    expect(mockVoltar).toHaveBeenCalledTimes(1)
  })

  it('exibe o relógio com o horário atual ou fornecido no cabeçalho', () => {
    render(<CabecalhoTotem horario="17:21" />)
    expect(screen.getByText('17:21')).toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: /horário atual: 17:21/i })
    ).toBeInTheDocument()
  })
})

describe('Componente: RodapeTotem', () => {
  it('exibe o relógio e a indicação de dados em tempo real da SPTrans', () => {
    render(<RodapeTotem />)

    expect(screen.getByText('Dados em tempo real')).toBeInTheDocument()
    expect(screen.getByText('SPTrans')).toBeInTheDocument()
    // O relógio exibe o horário formatado (ex: HH:MM)
    const horaRegex = /^\d{2}:\d{2}$/
    expect(screen.getByText(horaRegex)).toBeInTheDocument()
  })
})

describe('Componente: Icone', () => {
  it('renderiza os ícones do teclado virtual com viewBox 24x24', () => {
    const { container, rerender } = render(<Icone nome="teclado" />)
    const svgTeclado = container.querySelector('svg')
    expect(svgTeclado).toHaveAttribute('data-icone', 'teclado')
    expect(svgTeclado).toHaveAttribute('viewBox', '0 0 24 24')

    rerender(<Icone nome="apagar" />)
    const svgApagar = container.querySelector('svg')
    expect(svgApagar).toHaveAttribute('data-icone', 'apagar')

    rerender(<Icone nome="recolher" />)
    const svgRecolher = container.querySelector('svg')
    expect(svgRecolher).toHaveAttribute('data-icone', 'recolher')
  })

  it('suporta aliases em inglês para compatibilidade', () => {
    const { container, rerender } = render(<Icone nome="keyboard" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'data-icone',
      'keyboard'
    )

    rerender(<Icone nome="delete" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'data-icone',
      'delete'
    )

    rerender(<Icone nome="backspace" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'data-icone',
      'backspace'
    )
  })
})
