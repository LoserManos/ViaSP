import { useState, useEffect } from 'react'
import { Icon } from '../componentes/comuns/Icone'
import {
  obterPrevisoes,
  listarParadasDaLinha,
  obterTotem,
  calcularTempoEsperaMinutos,
} from '../servicos/api'
import { mockLinhas } from '../mocks/dadosMock'
import './TelaDetalheLinha.css'

const MIN_PER_STOP = 2.5
const HERE = 'Parada MASP'

const busRoutes = {
  '106A-10': { color: '#e5223a' },
  '8012-10': { color: '#e5223a' },
  '875A-10': { color: '#2563eb' },
  '175P-10': { color: '#059669' },
  '917H-10': { color: '#d97706' },
  '775P-10': { color: '#2563eb' },
}

const clockIn = (min) => {
  if (min === null || min === undefined || isNaN(min)) return ''
  return new Date(Date.now() + min * 60000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const linhasConhecidas = {
  '106A-10': {
    codigo: 1006,
    numero: '106A-10',
    origem: 'Itaim Bibi',
    destino: 'Metrô Santana',
    corBadge: 'vermelha',
  },
}

/**
 * Tela de Detalhes da Linha (LineScreen).
 * Carrega dinamicamente as paradas (itinerário) e previsões de chegada via API.
 */
export function TelaDetalheLinha({
  linha,
  code: propCode,
  aoVoltar,
  onBack,
  aoAbrirMapa,
  onMap,
}) {
  const handlerBack = aoVoltar || onBack || (() => {})
  const handlerMap = aoAbrirMapa || onMap || (() => {})
  const code = linha?.numero || propCode || ''

  // Localiza dados complementares da linha caso receba apenas o código string
  const linhaAtiva = linha ||
    mockLinhas.find((l) => l.numero === code) ||
    linhasConhecidas[code] || {
      codigo: 1001,
      numero: code,
      origem: 'Terminal A',
      destino: 'Terminal B',
      corBadge: 'vermelha',
    }

  const [paradas, setParadas] = useState([])
  const [carregandoParadas, setCarregandoParadas] = useState(true)
  const [erroParadas, setErroParadas] = useState(null)
  const [totemParada, setTotemParada] = useState(null)

  const [consultaPrevisao, setConsultaPrevisao] = useState(null)
  const [carregandoPrevisao, setCarregandoPrevisao] = useState(true)
  const [erroPrevisao, setErroPrevisao] = useState(null)

  const carregarPrevisoes = async () => {
    if (!linhaAtiva?.codigo) return
    setCarregandoPrevisao(true)
    setErroPrevisao(null)
    try {
      const dados = await obterPrevisoes(linhaAtiva.codigo)
      setConsultaPrevisao(dados)
    } catch (err) {
      setErroPrevisao(err.mensagem || 'Falha ao conectar com o servidor.')
    } finally {
      setCarregandoPrevisao(false)
    }
  }

  const carregarParadas = async () => {
    if (!linhaAtiva?.codigo) return
    setCarregandoParadas(true)
    setErroParadas(null)
    try {
      const dados = await listarParadasDaLinha(linhaAtiva.codigo, {
        numero: linhaAtiva.numero,
        sentido: linhaAtiva.sentido,
        destino: linhaAtiva.destino,
      })
      setParadas(Array.isArray(dados) ? dados : [])
    } catch (err) {
      setErroParadas(
        err?.mensagem || 'Falha ao carregar o itinerário da linha.'
      )
    } finally {
      setCarregandoParadas(false)
    }
  }

  // Carrega informações da parada atual do totem
  useEffect(() => {
    let ativo = true
    obterTotem()
      .then((t) => {
        if (ativo && t?.parada) {
          setTotemParada(t.parada)
        }
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  // Carrega paradas e previsões ao montar ou quando a linha mudar
  useEffect(() => {
    let ativo = true
    if (!linhaAtiva?.codigo) return

    Promise.resolve().then(() => {
      if (ativo) {
        setCarregandoParadas(true)
        setErroParadas(null)
        setCarregandoPrevisao(true)
        setErroPrevisao(null)
      }
    })

    listarParadasDaLinha(linhaAtiva.codigo, {
      numero: linhaAtiva.numero,
      sentido: linhaAtiva.sentido,
      destino: linhaAtiva.destino,
    })
      .then((dados) => {
        if (ativo) {
          setParadas(Array.isArray(dados) ? dados : [])
          setCarregandoParadas(false)
        }
      })
      .catch((err) => {
        if (ativo) {
          setErroParadas(err?.mensagem || 'Falha ao carregar o itinerário.')
          setCarregandoParadas(false)
        }
      })

    obterPrevisoes(linhaAtiva.codigo)
      .then((dados) => {
        if (ativo) {
          setConsultaPrevisao(dados)
          setCarregandoPrevisao(false)
        }
      })
      .catch((err) => {
        if (ativo) {
          setErroPrevisao(err.mensagem || 'Falha ao conectar com o servidor.')
          setCarregandoPrevisao(false)
        }
      })

    return () => {
      ativo = false
    }
  }, [linhaAtiva?.codigo, linhaAtiva?.destino, linhaAtiva?.numero, linhaAtiva?.sentido])

  if (!linha && !propCode) {
    return (
      <section className="map-section line-screen">
        <div className="section-header line-header">
          <button
            type="button"
            className="action-button back-button"
            onClick={handlerBack}
            aria-label="Voltar para a lista de linhas"
          >
            <span className="back-icon">
              <Icon name="arrow" size={20} />
            </span>
            Voltar
          </button>
        </div>
        <div className="line-panel" style={{ padding: '24px' }}>
          <strong>Nenhuma linha selecionada.</strong>
        </div>
      </section>
    )
  }

  const from = linhaAtiva.origem || 'Terminal Origem'
  const to = linhaAtiva.destino || 'Terminal Destino'
  const hours = linhaAtiva.horario_funcionamento || '4h40 – 0h30'
  const headway = linhaAtiva.intervalo_medio || 12

  const totemParadaNome = totemParada?.nome || HERE
  const totemCodigo = totemParada?.codigo

  // Converte a lista de paradas da API para o formato visual esperado pelo diagrama
  const stopsBase =
    paradas.length > 0
      ? paradas.map((p) => {
          const name = p.nome || p.name || 'Parada'
          let transfer = p.transfer
          if (!transfer && /metr[oô]/i.test(name)) {
            const m = name.match(/L\d+/i)
            transfer = m ? m[0] : 'Metrô'
          }
          return {
            name,
            transfer,
            access: p.access !== undefined ? p.access : true,
            codigo: p.codigo,
          }
        })
      : [
          { name: from, access: true },
          { name: totemParadaNome, access: true, codigo: totemCodigo },
          { name: to, access: true },
        ]

  const stops = stopsBase
  const towards = to

  // Cor da linha: busca nas rotas conhecidas, na badge da linha ou default escuro
  const color =
    busRoutes[code]?.color ??
    (linhaAtiva?.corBadge
      ? `var(--cor-linha-${linhaAtiva.corBadge})`
      : '#e5223a')

  // Processa as previsões reais vindas da SPTrans
  const previsoesProcessadas = (consultaPrevisao?.previsoes || []).map((p) => {
    const minutos = calcularTempoEsperaMinutos(
      p.horario_previsto,
      consultaPrevisao?.horario_referencia
    )
    return {
      ...p,
      minutos: minutos ?? 0,
    }
  })

  previsoesProcessadas.sort((a, b) => a.minutos - b.minutos)

  const primeiraPrevisao = previsoesProcessadas[0] || null
  const firstEta = primeiraPrevisao ? primeiraPrevisao.minutos : null
  const firstHorario =
    primeiraPrevisao?.horario_previsto ||
    (firstEta !== null ? clockIn(firstEta) : null)
  const departures = previsoesProcessadas.map((p) => p.minutos)

  // Localiza o índice da parada atual na ordem ativa do trajeto
  let hereIdx = stops.findIndex(
    (s) =>
      (totemCodigo && (s.codigo === totemCodigo || String(s.codigo) === String(totemCodigo))) ||
      (totemParadaNome && s.name && s.name.toLowerCase() === totemParadaNome.toLowerCase()) ||
      (totemParadaNome && s.name && s.name.toLowerCase().includes(totemParadaNome.toLowerCase())) ||
      s.name === HERE ||
      s.name?.toLowerCase().includes('masp')
  )

  if (hereIdx === -1 && totemParadaNome) {
    const palavras = totemParadaNome.toLowerCase().split(/[\s,—-]+/).filter((w) => w.length > 3)
    if (palavras.length > 0) {
      hereIdx = stops.findIndex((s) => {
        const nomeLower = (s.name || '').toLowerCase()
        return palavras.some((p) => nomeLower.includes(p))
      })
    }
  }

  if (hereIdx === -1) {
    hereIdx = 0
  }

  const buses = departures
    .map((eta) => ({ eta, pos: hereIdx - eta / MIN_PER_STOP }))
    .filter((b) => b.pos >= 0)
  const ROW = 64

  return (
    <section
      className="map-section line-screen"
      aria-labelledby="line-title"
      style={{ '--line-color': color }}
    >
      <div className="section-header line-header">
        <button
          type="button"
          className="action-button back-button"
          onClick={handlerBack}
          aria-label="Voltar para a lista de linhas"
        >
          <span className="back-icon">
            <Icon name="arrow" size={20} />
          </span>
          Voltar
        </button>

        <div className="line-title-group">
          <span className="line-code">
            <Icon name="bus" size={26} />
            {code}
          </span>
          <div>
            <div className="section-label">
              <Icon name="route" size={19} /> Linha de ônibus
            </div>
            <h2 id="line-title">Destino: {towards}</h2>
            <div className="sr-only">
              Sentido: {from} → {to}
            </div>
          </div>
        </div>
      </div>

      <div className="map-body line-body">
        {/* Diagrama Interativo do Itinerário */}
        <div className="line-diagram-wrap">
          <div className="line-diagram-head">
            <span>
              {stops.length} paradas · {stops[0]?.name} → {towards}
            </span>
            <span className="updated">
              <span /> Posição ao vivo
            </span>
          </div>

          {carregandoParadas && paradas.length === 0 ? (
            <div className="line-loading-box" role="status">
              <div className="line-loading-spinner" aria-hidden="true" />
              <span>Carregando itinerário da linha...</span>
            </div>
          ) : erroParadas && paradas.length === 0 ? (
            <div className="line-error-box">
              <span>{erroParadas}</span>
              <button
                type="button"
                className="line-retry-btn"
                onClick={carregarParadas}
              >
                Tentar carregar itinerário novamente
              </button>
            </div>
          ) : (
            <div className="line-diagram" style={{ '--row': `${ROW}px` }}>
              <span className="line-track" aria-hidden="true">
                <span
                  className="line-track-done"
                  style={{ height: `${hereIdx * ROW}px` }}
                />
              </span>

              {buses.map((b) => (
                <span
                  key={b.eta}
                  className="line-bus"
                  style={{ top: `${b.pos * ROW + ROW / 2}px` }}
                  aria-hidden="true"
                >
                  <Icon name="bus" size={16} />
                  <b>{b.eta} min</b>
                </span>
              ))}

              <ol className="line-stops">
                {stops.map((s, i) => {
                  const state =
                    i < hereIdx ? 'past' : i === hereIdx ? 'here' : 'next'
                  return (
                    <li
                      key={`${s.codigo || s.name}-${i}`}
                      className={`line-stop ${state} ${i === stops.length - 1 ? 'terminal' : ''} ${i === 0 ? 'start' : ''}`}
                    >
                      <span className="line-node" aria-hidden="true" />
                      <div className="line-stop-text">
                        <strong>{s.name}</strong>
                        <span className="line-stop-meta">
                          {state === 'here' && (
                            <em className="here-tag">Você está aqui</em>
                          )}
                          {s.transfer && (
                            <span className="metro-tag">
                              <Icon name="route" size={13} /> Metrô {s.transfer}
                            </span>
                          )}
                          {s.access && (
                            <span className="access-tag" title="Parada acessível">
                              <Icon name="accessibility" size={14} />
                              <span className="sr-only">Parada acessível</span>
                            </span>
                          )}
                        </span>
                      </div>

                      <span className="line-stop-time">
                        {state === 'next' ? (
                          firstEta !== null ? (
                            <>
                              {clockIn(Math.round(firstEta + (i - hereIdx) * MIN_PER_STOP))}
                              <small>+{Math.round((i - hereIdx) * MIN_PER_STOP)} min</small>
                            </>
                          ) : null
                        ) : state === 'here' ? (
                          firstEta !== null ? (
                            <>
                              {firstHorario}
                              <small>embarque</small>
                            </>
                          ) : (
                            <small>embarque</small>
                          )
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Painel Lateral com Próximas Chegadas */}
        <aside className="map-detail line-panel" aria-live="polite">
          <div className="line-next">
            <span className="line-next-label">Próximo ônibus nesta parada</span>
            {firstEta !== null ? (
              <>
                <strong className={firstEta <= 3 ? 'soon' : ''}>
                  {firstEta}
                  <small> min</small>
                </strong>
                <span>
                  Sentido <b>{towards}</b> · às {firstHorario}
                </span>
              </>
            ) : carregandoPrevisao ? (
              <span>Carregando previsão...</span>
            ) : (
              <span>Nenhum veículo a caminho</span>
            )}
          </div>

          {previsoesProcessadas.length > 1 ? (
            <ul className="line-departures">
              {previsoesProcessadas.slice(1).map((p, idx) => (
                <li key={p.veiculo?.prefixo || idx}>
                  <span>{idx === 0 ? 'Depois' : `${idx + 2}º veículo`}</span>
                  <strong>{p.minutos} min</strong>
                  <small>{p.horario_previsto}</small>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Previsões em Tempo Real da SPTrans (quando disponíveis) */}
          {erroPrevisao ? (
            <div className="line-error-box">
              <span>{erroPrevisao}</span>
              <button
                type="button"
                className="line-retry-btn"
                onClick={carregarPrevisoes}
                aria-label="Tentar novamente"
              >
                Tentar carregar as informações novamente
              </button>
            </div>
          ) : consultaPrevisao?.previsoes &&
            consultaPrevisao.previsoes.length > 0 ? (
            <div className="line-realtime-section" role="list">
              <span className="line-next-label">
                Veículos em circulação (SPTrans)
              </span>
              {consultaPrevisao.previsoes.map((p, idx) => (
                <div key={idx} className="line-realtime-row" role="listitem">
                  <div className="line-realtime-left">
                    <Icon name="bus" size={16} />
                    <div>
                      <strong>Chegada prevista às {p.horario_previsto}</strong>
                      <small>Veículo prefixo #{p.veiculo.prefixo}</small>
                    </div>
                  </div>
                  <span
                    className={`line-realtime-tag ${idx === 0 ? 'line-realtime-tag--destaque' : ''}`}
                  >
                    {idx === 0 ? 'Próximo' : `${idx + 1}º veículo`}
                  </span>
                </div>
              ))}
            </div>
          ) : consultaPrevisao?.previsoes &&
            consultaPrevisao.previsoes.length === 0 ? (
            <div className="line-empty-box">
              <strong>Sem previsão no momento</strong>
              <small>
                Não há veículos em circulação informados para esta linha no
                momento.
              </small>
            </div>
          ) : null}

          <dl className="line-facts">
            <div>
              <dt>Funcionamento</dt>
              <dd>{hours}</dd>
            </div>
            <div>
              <dt>Intervalo médio</dt>
              <dd>{headway} min</dd>
            </div>
            <div>
              <dt>Tarifa</dt>
              <dd>R$ 5,00</dd>
            </div>
            <div>
              <dt>Até o fim</dt>
              <dd>
                {Math.round((stops.length - 1 - hereIdx) * MIN_PER_STOP)} min
              </dd>
            </div>
          </dl>

          <p className="detail-note">
            <Icon name="accessibility" size={18} /> Frota com elevador e espaço
            para cadeira de rodas.
          </p>

          <button type="button" className="detail-cta" onClick={handlerMap}>
            Ver linha no mapa <Icon name="arrow" size={18} />
          </button>
        </aside>
      </div>
    </section>
  )
}

export const LineScreen = TelaDetalheLinha
