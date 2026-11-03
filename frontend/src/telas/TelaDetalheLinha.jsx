import { useState, useEffect } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { Icone } from '../componentes/comuns/Icone'
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
  const [carregandoParadas, setCarregandoParadas] = useState(true)
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(true)
  const [erroParadas, setErroParadas] = useState(null)
  const [erroPrevisao, setErroPrevisao] = useState(null)

  const carregarParadas = async () => {
    if (!linha?.codigo) return
    setCarregandoParadas(true)
    setErroParadas(null)
    try {
      const dados = await listarParadasDaLinha(linha.codigo)
      setParadas(dados || [])
    } catch (err) {
      setErroParadas(err.mensagem || 'Falha ao consultar itinerário da linha.')
    } finally {
      setCarregandoParadas(false)
    }
  }

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
        setCarregandoParadas(false)
        setCarregandoPrevisao(false)
        return
      }

      setCarregandoParadas(true)
      setCarregandoPrevisao(true)
      setErroParadas(null)
      setErroPrevisao(null)

      const [resParadas, resPrevisoes] = await Promise.allSettled([
        listarParadasDaLinha(linha.codigo),
        obterPrevisoes(linha.codigo),
      ])

      if (!ativo) return

      if (resParadas.status === 'fulfilled') {
        setParadas(resParadas.value || [])
      } else {
        setErroParadas(
          resParadas.reason?.mensagem ||
            'Falha ao consultar itinerário da linha.'
        )
      }
      setCarregandoParadas(false)

      if (resPrevisoes.status === 'fulfilled') {
        setConsultaPrevisao(resPrevisoes.value)
      } else {
        setErroPrevisao(
          resPrevisoes.reason?.mensagem ||
            'Falha ao consultar previsões de chegada.'
        )
      }
      setCarregandoPrevisao(false)
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
      {/* Barra de Ação Superior com Botão de Voltar Sempre Visível (ISS-17 / Ergonomia) */}
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

      {/* Cartão de Destaque da Linha (ISS-17.1: número, sentido e destino) */}
      <Cartao destaque className="viasp-detalhe-linha__cartao-linha">
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
                : linha.destino}
            </TextoGrande>
          </div>
        </div>
      </Cartao>

      {/* Previsão de Chegada dos Próximos Veículos (US06 / US07 / ISS-18) */}
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
                  <Icone
                    nome="cronometro"
                    className="viasp-detalhe-linha__previsao-icone"
                  />
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

      {/* Itinerário Simplificado e Principais Paradas (US03 / ISS-17.2) */}
      <section className="viasp-detalhe-linha__secao">
        <TextoGrande as="h2" variante="subtitulo">
          Itinerário e principais paradas da rota
        </TextoGrande>

        {erroParadas ? (
          <MensagemErro
            mensagem={erroParadas}
            aoTentarNovamente={carregarParadas}
          />
        ) : carregandoParadas ? (
          <Cartao>
            <TextoGrande variante="corpo" cor="secundario">
              Carregando paradas da linha...
            </TextoGrande>
          </Cartao>
        ) : paradas.length === 0 ? (
          <Cartao>
            <TextoGrande variante="corpo" cor="secundario">
              Nenhuma parada disponível para esta linha no momento.
            </TextoGrande>
          </Cartao>
        ) : (
          <div className="viasp-detalhe-linha__itinerario-lista" role="list">
            {paradas.map((parada, idx) => (
              <div
                key={parada.codigo}
                className="viasp-detalhe-linha__parada-item"
                role="listitem"
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
