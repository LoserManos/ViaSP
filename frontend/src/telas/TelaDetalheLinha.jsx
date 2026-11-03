import { useState, useEffect } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { Icone } from '../componentes/comuns/Icone'
import { MensagemErro } from '../componentes/feedback/MensagemErro'
import { obterPrevisoes } from '../servicos/api'
import './TelaDetalheLinha.css'

/**
 * Tela de Detalhes da Linha (US06, US07 / ISS-17, ISS-18).
 * Alinhada à identidade visual e métricas de acessibilidade do Figma.
 *
 * @param {object} props
 * @param {object} props.linha - Objeto da linha selecionada.
 * @param {() => void} props.aoVoltar - Callback para voltar à tela anterior (sempre visível).
 */
export function TelaDetalheLinha({ linha, aoVoltar }) {
  const [consultaPrevisao, setConsultaPrevisao] = useState(null)
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(true)
  const [erroPrevisao, setErroPrevisao] = useState(null)

  const carregarPrevisoes = async () => {
    if (!linha?.codigo) return
    setCarregandoPrevisao(true)
    setErroPrevisao(null)
    try {
      const dados = await obterPrevisoes(linha.codigo)
      setConsultaPrevisao(dados)
    } catch (err) {
      setErroPrevisao(
        err.mensagem || 'Falha ao consultar previsões de chegada.'
      )
    } finally {
      setCarregandoPrevisao(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!linha?.codigo) {
        setCarregandoPrevisao(false)
        return
      }

      setCarregandoPrevisao(true)
      setErroPrevisao(null)

      try {
        const dados = await obterPrevisoes(linha.codigo)
        if (ativo) {
          setConsultaPrevisao(dados)
        }
      } catch (err) {
        if (ativo) {
          setErroPrevisao(
            err.mensagem || 'Falha ao consultar previsões de chegada.'
          )
        }
      } finally {
        if (ativo) {
          setCarregandoPrevisao(false)
        }
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [linha?.codigo])

  if (!linha) {
    return (
      <div className="viasp-detalhe-linha">
        <div className="viasp-detalhe-linha__topo">
          <Botao
            variante="voltar"
            tamanho="grande"
            onClick={aoVoltar}
            ariaLabel="Voltar para a lista de linhas"
          >
            Voltar para todas as linhas
          </Botao>
        </div>
        <Cartao className="viasp-detalhe-linha__cartao-vazio">
          <TextoGrande variante="destaque" peso="bold">
            Nenhuma linha selecionada.
          </TextoGrande>
          <TextoGrande variante="corpo" cor="secundario">
            Retorne à tela inicial para escolher uma das linhas disponíveis
            neste ponto.
          </TextoGrande>
        </Cartao>
      </div>
    )
  }

  return (
    <div className="viasp-detalhe-linha">
      {/* 1. Barra de Ação Superior com Botão de Voltar Ergonômico (Figma) */}
      <div className="viasp-detalhe-linha__topo">
        <Botao
          variante="voltar"
          tamanho="grande"
          onClick={aoVoltar}
          ariaLabel="Voltar para a lista de linhas"
          className="viasp-detalhe-linha__btn-voltar"
        >
          Voltar para todas as linhas
        </Botao>
      </div>

      {/* 2. Cartão de Destaque da Linha (Figma) */}
      <Cartao destaque className="viasp-detalhe-linha__cartao-linha">
        <div className="viasp-detalhe-linha__tag-linha">
          <span className="viasp-detalhe-linha__tag-dot" />
          <span>DETALHES DA LINHA</span>
        </div>

        <div className="viasp-detalhe-linha__identificacao">
          <div
            className={`viasp-detalhe-linha__badge viasp-detalhe-linha__badge--${linha.corBadge || 'azul'}`}
            aria-label={`Linha ${linha.numero}`}
          >
            <Icone nome="onibus" />
            <span>{linha.numero}</span>
          </div>

          <div className="viasp-detalhe-linha__info-topo">
            <TextoGrande as="h1" variante="titulo">
              Destino: {linha.destino}
            </TextoGrande>
            <TextoGrande variante="destaque" cor="secundario">
              Sentido:{' '}
              {linha.origem
                ? `${linha.origem} → ${linha.destino}`
                : typeof linha.sentido === 'string'
                  ? linha.sentido
                  : linha.destino}
            </TextoGrande>
          </div>
        </div>
      </Cartao>

      {/* 3. Seção de Previsão de Chegada dos Próximos Veículos (Figma) */}
      <section className="viasp-detalhe-linha__secao">
        <div className="viasp-detalhe-linha__secao-cabecalho">
          <TextoGrande as="h2" variante="subtitulo">
            Próximos ônibus neste ponto
          </TextoGrande>
          {consultaPrevisao?.horario_referencia && (
            <span className="viasp-detalhe-linha__atualizacao">
              Última atualização às {consultaPrevisao.horario_referencia}
            </span>
          )}
        </div>

        {erroPrevisao ? (
          <MensagemErro
            mensagem={erroPrevisao}
            aoTentarNovamente={carregarPrevisoes}
          />
        ) : carregandoPrevisao ? (
          <Cartao className="viasp-detalhe-linha__carregando" role="status">
            <div className="viasp-detalhe-linha__spinner" aria-hidden="true" />
            <TextoGrande variante="destaque">
              Consultando previsão de chegada na SPTrans...
            </TextoGrande>
          </Cartao>
        ) : consultaPrevisao?.previsoes &&
          consultaPrevisao.previsoes.length > 0 ? (
          <div className="viasp-detalhe-linha__grade-previsoes" role="list">
            <div
              className="viasp-detalhe-linha__tabela-topo"
              aria-hidden="true"
            >
              <span>VEÍCULO E PREVISÃO</span>
              <span>ORDEM DE CHEGADA</span>
            </div>

            {consultaPrevisao.previsoes.map((item, index) => (
              <div
                key={index}
                className="viasp-detalhe-linha__card-previsao"
                role="listitem"
              >
                <div className="viasp-detalhe-linha__previsao-esquerda">
                  <div
                    className={`viasp-detalhe-linha__previsao-icone-box ${index === 0 ? 'viasp-detalhe-linha__previsao-icone-box--destaque' : ''}`}
                  >
                    <Icone
                      nome="cronometro"
                      className="viasp-detalhe-linha__previsao-icone"
                    />
                  </div>
                  <div>
                    <TextoGrande variante="destaque" peso="bold">
                      Chegada prevista às {item.horario_previsto}
                    </TextoGrande>
                    <TextoGrande variante="pequeno" cor="secundario">
                      Veículo prefixo #{item.veiculo.prefixo}
                    </TextoGrande>
                  </div>
                </div>

                <div className="viasp-detalhe-linha__previsao-direita">
                  <span
                    className={`viasp-detalhe-linha__tempo-destaque ${index === 0 ? 'viasp-detalhe-linha__tempo-destaque--proximo' : ''}`}
                  >
                    {index === 0 ? 'Próximo' : `${index + 1}º veículo`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Cartao className="viasp-detalhe-linha__cartao-vazio">
            <TextoGrande variante="destaque" peso="bold">
              Sem previsão no momento
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Não há veículos em circulação informados para esta linha no
              momento.
            </TextoGrande>
          </Cartao>
        )}
      </section>
    </div>
  )
}
