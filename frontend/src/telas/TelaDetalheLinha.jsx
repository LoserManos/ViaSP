import { useState, useEffect } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { MensagemErro } from '../componentes/feedback/MensagemErro'
import { obterPrevisoes, listarParadasDaLinha } from '../servicos/api'
import './TelaDetalheLinha.css'

/**
 * Tela de Detalhes da Linha (US03, US06, US07 / ISS-17, ISS-18).
 *
 * @param {object} props
 * @param {object} props.linha - Objeto da linha selecionada.
 * @param {() => void} props.aoVoltar - Callback para voltar à tela anterior (sempre visível).
 */
export function TelaDetalheLinha({ linha, aoVoltar }) {
  const [consultaPrevisao, setConsultaPrevisao] = useState(null)
  const [paradas, setParadas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregarDetalhes = async () => {
    if (!linha?.codigo) return
    setCarregando(true)
    setErro(null)

    try {
      const [dadosPrevisao, dadosParadas] = await Promise.all([
        obterPrevisoes(linha.codigo),
        listarParadasDaLinha(linha.codigo),
      ])
      setConsultaPrevisao(dadosPrevisao)
      setParadas(dadosParadas)
    } catch (err) {
      setErro(err.mensagem || 'Falha ao consultar previsões e itinerário.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!linha?.codigo) return
      try {
        const [dadosPrevisao, dadosParadas] = await Promise.all([
          obterPrevisoes(linha.codigo),
          listarParadasDaLinha(linha.codigo),
        ])
        if (ativo) {
          setConsultaPrevisao(dadosPrevisao)
          setParadas(dadosParadas)
        }
      } catch (err) {
        if (ativo) {
          setErro(err.mensagem || 'Falha ao consultar previsões e itinerário.')
        }
      } finally {
        if (ativo) {
          setCarregando(false)
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
        <Botao variante="voltar" onClick={aoVoltar}>
          Voltar para as linhas
        </Botao>
        <Cartao>
          <TextoGrande variante="destaque">
            Nenhuma linha selecionada.
          </TextoGrande>
        </Cartao>
      </div>
    )
  }

  return (
    <div className="viasp-detalhe-linha">
      {/* Barra de Ação Superior com Botão de Voltar Sempre Visível */}
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

      {/* Cartão de Destaque da Linha */}
      <Cartao destaque className="viasp-detalhe-linha__cartao-linha">
        <div className="viasp-detalhe-linha__identificacao">
          <div
            className={`viasp-detalhe-linha__badge viasp-detalhe-linha__badge--${linha.corBadge || 'azul'}`}
          >
            🚌 {linha.numero}
          </div>
          <div>
            <TextoGrande as="h1" variante="titulo">
              {linha.destino}
            </TextoGrande>
            <TextoGrande variante="destaque" cor="secundario">
              Origem: {linha.origem}
            </TextoGrande>
          </div>
        </div>
      </Cartao>

      {/* Feedback de Erro */}
      {erro && (
        <MensagemErro mensagem={erro} aoTentarNovamente={carregarDetalhes} />
      )}

      {/* Previsão de Chegada dos Próximos Veículos (US06 / US07) */}
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

        {carregando ? (
          <Cartao>
            <TextoGrande variante="corpo" cor="secundario">
              Consultando previsão de chegada na SPTrans...
            </TextoGrande>
          </Cartao>
        ) : consultaPrevisao?.previsoes &&
          consultaPrevisao.previsoes.length > 0 ? (
          <div className="viasp-detalhe-linha__grade-previsoes">
            {consultaPrevisao.previsoes.map((item, index) => (
              <Cartao
                key={index}
                className="viasp-detalhe-linha__card-previsao"
              >
                <div className="viasp-detalhe-linha__previsao-esquerda">
                  <span
                    className="viasp-detalhe-linha__previsao-icone"
                    aria-hidden="true"
                  >
                    ⏱️
                  </span>
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
                  <span className="viasp-detalhe-linha__tempo-destaque">
                    {index === 0 ? 'Próximo' : `${index + 1}º veículo`}
                  </span>
                </div>
              </Cartao>
            ))}
          </div>
        ) : (
          <Cartao>
            <TextoGrande variante="destaque">
              Sem previsão no momento
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Não há veículos em circulação informados para esta linha no
              momento.
            </TextoGrande>
          </Cartao>
        )}
      </section>

      {/* Itinerário Simplificado e Principais Paradas (US03) */}
      <section className="viasp-detalhe-linha__secao">
        <TextoGrande as="h2" variante="subtitulo">
          Itinerário e principais paradas da rota
        </TextoGrande>

        {carregando ? (
          <Cartao>
            <TextoGrande variante="corpo" cor="secundario">
              Carregando paradas da linha...
            </TextoGrande>
          </Cartao>
        ) : (
          <div className="viasp-detalhe-linha__itinerario-lista">
            {paradas.map((parada, idx) => (
              <div
                key={parada.codigo}
                className="viasp-detalhe-linha__parada-item"
              >
                <div className="viasp-detalhe-linha__parada-marcador">
                  <span className="viasp-detalhe-linha__parada-ponto" />
                  {idx < paradas.length - 1 && (
                    <span className="viasp-detalhe-linha__parada-linha" />
                  )}
                </div>
                <div className="viasp-detalhe-linha__parada-dados">
                  <TextoGrande variante="destaque" peso="bold">
                    {parada.nome}
                  </TextoGrande>
                  <TextoGrande variante="pequeno" cor="secundario">
                    {parada.endereco}
                  </TextoGrande>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
