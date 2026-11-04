import { useState, useEffect } from 'react'
import { Icone } from '../comuns/Icone'
import './RodapeTotem.css'

/**
 * Rodapé inferior do Totem.
 * Exibe o relógio atualizado dinamicamente e a indicação de dados em tempo real da SPTrans.
 */
export function RodapeTotem() {
  const [horaAtual, setHoraAtual] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  )

  useEffect(() => {
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
  }, [])

  return (
    <footer className="viasp-rodape-totem" role="contentinfo">
      <div className="viasp-rodape-totem__esquerda">
        <Icone
          nome="relogio"
          tamanho="1.25rem"
          className="viasp-rodape-totem__icone-relogio"
        />
        <span
          className="viasp-rodape-totem__hora"
          aria-label={`Horário atual: ${horaAtual}`}
        >
          {horaAtual}
        </span>
      </div>

      <div className="viasp-rodape-totem__direita">
        <span className="viasp-rodape-totem__ponto-vivo" aria-hidden="true" />
        <span>Dados em tempo real</span>
        <span className="viasp-rodape-totem__divisor" aria-hidden="true">
          •
        </span>
        <strong className="viasp-rodape-totem__sptrans-nome">SPTrans</strong>
      </div>
    </footer>
  )
}
