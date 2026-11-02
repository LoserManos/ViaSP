import { Botao, Cartao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import './MensagemErro.css'

/**
 * Componente amigável de feedback de erro com botão de nova tentativa (US08 / ISS-20).
 *
 * @param {object} props
 * @param {string} props.mensagem - Mensagem de erro em linguagem simples.
 * @param {() => void} [props.aoTentarNovamente] - Callback disparado ao clicar em "Tentar novamente".
 * @param {boolean} [props.permitirTentarNovamente=true] - Se deve exibir o botão de retry.
 */
export function MensagemErro({
  mensagem,
  aoTentarNovamente,
  permitirTentarNovamente = true,
}) {
  return (
    <Cartao className="viasp-mensagem-erro" role="alert">
      <Icone
        nome="alerta"
        tamanho="2rem"
        className="viasp-mensagem-erro__icone"
      />
      <div className="viasp-mensagem-erro__conteudo">
        <TextoGrande variante="destaque" cor="erro" peso="bold">
          Não foi possível carregar as informações
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          {mensagem}
        </TextoGrande>
      </div>
      {permitirTentarNovamente && aoTentarNovamente && (
        <Botao
          variante="secundario"
          onClick={aoTentarNovamente}
          ariaLabel="Tentar carregar as informações novamente"
        >
          Tentar novamente
        </Botao>
      )}
    </Cartao>
  )
}
