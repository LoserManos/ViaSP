import { Botao, TextoGrande } from '../base'
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
 */
export function CabecalhoTotem({ nomeParada, aoVoltar, tituloTela }) {
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
    </header>
  )
}
