import { useState, useEffect } from 'react'
import { Botao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import { LogoViaSP } from '../comuns/LogoViaSP'
import './CabecalhoTotem.css'

/**
 * Cabeçalho unificado do totem para todas as telas.
 *
 * @param {object} props
 * @param {string} [props.nomeParada] - Nome do ponto de ônibus onde o totem está instalado
 *   (vem de `/api/totem`); sem ele, o logo mostra o subtítulo padrão.
 * @param {() => void} [props.aoVoltar] - Se presente, exibe o botão de voltar sempre visível (ISS-14.2).
 * @param {string} [props.tituloTela] - Título opcional da tela atual.
 * @param {string} [props.horario] - Horário opcional para sobrescrever o relógio dinâmico (útil em testes).
 */
export function CabecalhoTotem({ nomeParada, aoVoltar, tituloTela, horario }) {
  const [horaAtual, setHoraAtual] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )

  useEffect(() => {
    if (horario) return

    const atualizar = () => {
      setHoraAtual(
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    }

    const timer = setInterval(atualizar, 1000)
    return () => clearInterval(timer)
  }, [horario])

  const horarioExibicao = horario || horaAtual

  return (
    <header className="viasp-cabecalho-totem">
      <div className="viasp-cabecalho-totem__esquerda">
        {aoVoltar && (
          <Botao
            variante="voltar"
            onClick={aoVoltar}
            ariaLabel="Voltar para a tela anterior"
            className="viasp-cabecalho-totem__btn-voltar"
          >
            Voltar
          </Botao>
        )}

        <LogoViaSP
          {...(nomeParada && { subtituloPersonalizado: nomeParada })}
        />

        {tituloTela && (
          <div className="viasp-cabecalho-totem__titulo-tela">
            <TextoGrande as="h1" variante="subtitulo" peso="bold">
              {tituloTela}
            </TextoGrande>
          </div>
        )}
      </div>

      <div
        className="viasp-cabecalho-totem__relogio"
        role="status"
        aria-label={`Horário atual: ${horarioExibicao}`}
      >
        <Icone
          nome="relogio"
          tamanho="1.25rem"
          className="viasp-cabecalho-totem__relogio-icone"
        />
        <span className="viasp-cabecalho-totem__relogio-hora">
          {horarioExibicao}
        </span>
      </div>
    </header>
  )
}
