import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TecladoVirtual } from '../src/componentes/totem/TecladoVirtual'

describe('Componente: TecladoVirtual (ISS-16.1 / US02)', () => {
  const propsPadrao = {
    aoDigitar: vi.fn(),
    aoApagar: vi.fn(),
    aoLimpar: vi.fn(),
    aoFechar: vi.fn(),
  }

  it('renderiza o teclado com região e rótulo de acessibilidade', () => {
    render(<TecladoVirtual {...propsPadrao} />)

    const secao = screen.getByRole('region', {
      name: /teclado virtual do totem/i,
    })
    expect(secao).toBeInTheDocument()
  })

  it('renderiza todas as teclas numéricas de 0 a 9', () => {
    render(<TecladoVirtual {...propsPadrao} />)

    for (let i = 0; i <= 9; i++) {
      expect(
        screen.getByRole('button', { name: new RegExp(`Tecla ${i}$`) })
      ).toBeInTheDocument()
    }
  })

  it('renderiza as teclas alfabéticas e o hífen', () => {
    render(<TecladoVirtual {...propsPadrao} />)

    const letras = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('')
    for (const letra of letras) {
      expect(
        screen.getByRole('button', { name: new RegExp(`Tecla ${letra}$`) })
      ).toBeInTheDocument()
    }

    expect(screen.getByRole('button', { name: 'Tecla -' })).toBeInTheDocument()
  })

  it('renderiza os botões de ação: Limpar, Espaço, Apagar e Ocultar', () => {
    render(<TecladoVirtual {...propsPadrao} />)

    expect(
      screen.getByRole('button', { name: /limpar busca/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^espaço$/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /apagar caractere/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /ocultar teclado/i })
    ).toBeInTheDocument()
  })

  it('dispara aoDigitar com o caractere correto ao tocar nas teclas', () => {
    const aoDigitar = vi.fn()
    render(<TecladoVirtual {...propsPadrao} aoDigitar={aoDigitar} />)

    fireEvent.click(screen.getByRole('button', { name: 'Tecla 8' }))
    expect(aoDigitar).toHaveBeenCalledWith('8')

    fireEvent.click(screen.getByRole('button', { name: 'Tecla 0' }))
    expect(aoDigitar).toHaveBeenCalledWith('0')

    fireEvent.click(screen.getByRole('button', { name: 'Tecla U' }))
    expect(aoDigitar).toHaveBeenCalledWith('U')

    fireEvent.click(screen.getByRole('button', { name: 'Tecla -' }))
    expect(aoDigitar).toHaveBeenCalledWith('-')

    fireEvent.click(screen.getByRole('button', { name: /^espaço$/i }))
    expect(aoDigitar).toHaveBeenCalledWith(' ')

    expect(aoDigitar).toHaveBeenCalledTimes(5)
  })

  it('dispara aoApagar ao tocar no botão de apagar', () => {
    const aoApagar = vi.fn()
    render(<TecladoVirtual {...propsPadrao} aoApagar={aoApagar} />)

    fireEvent.click(screen.getByRole('button', { name: /apagar caractere/i }))
    expect(aoApagar).toHaveBeenCalledTimes(1)
  })

  it('dispara aoLimpar ao tocar no botão de limpar', () => {
    const aoLimpar = vi.fn()
    render(<TecladoVirtual {...propsPadrao} aoLimpar={aoLimpar} />)

    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
    expect(aoLimpar).toHaveBeenCalledTimes(1)
  })

  it('dispara aoFechar ao tocar no botão de ocultar', () => {
    const aoFechar = vi.fn()
    render(<TecladoVirtual {...propsPadrao} aoFechar={aoFechar} />)

    fireEvent.click(screen.getByRole('button', { name: /ocultar teclado/i }))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })

  it('previne perda de foco no mouseDown das teclas', () => {
    render(<TecladoVirtual {...propsPadrao} />)

    const btnTecla = screen.getByRole('button', { name: 'Tecla 8' })
    const eventoMouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    })
    const cancelado = !btnTecla.dispatchEvent(eventoMouseDown)

    expect(cancelado).toBe(true)
  })
})
