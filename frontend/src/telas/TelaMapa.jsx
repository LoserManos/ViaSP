import { useEffect, useRef, useState } from 'react'
import { Icon } from '../componentes/comuns/Icone'
import { MapaDoPonto } from '../componentes/totem/MapaDoPonto'
import {
  obterTotem,
  listarLinhas,
  obterPrevisoes,
  calcularTempoEsperaMinutos,
} from '../servicos/api'
import './TelaMapa.css'

/**
 * Tela Dedicada de Mapa da Região e Arredores (ISS-19 / US05 / Figma).
 * 100% dinâmica: utiliza o mapa real (Leaflet/OSM) com as coordenadas GPS do totem
 * e as linhas e previsões reais fornecidas pela API do backend.
 *
 * @param {object} props
 * @param {object} [props.parada] - Dados da parada configurada no totem.
 * @param {object} [props.linha] - Linha opcional caso venha da tela de detalhes.
 * @param {string} [props.initialLine] - Número da linha inicial para foco.
 * @param {() => void} [props.aoVoltar] - Callback para retornar à tela anterior.
 * @param {() => void} [props.onBack] - Alias para aoVoltar.
 * @param {(linha: object | string) => void} [props.aoSelecionarLinha] - Navega para detalhes da linha.
 * @param {(linha: object | string) => void} [props.onOpenLine] - Alias para aoSelecionarLinha.
 * @param {() => void} [props.aoAbrirSeletorDev] - Abre o seletor de parada em modo de desenvolvimento.
 * @param {boolean} [props.forcarFalhaMapa=false] - Força fallback para testes.
 */
export function TelaMapa({
  parada: paradaProp,
  linha: linhaProp,
  initialLine = null,
  aoVoltar,
  onBack,
  aoSelecionarLinha,
  onOpenLine,
  aoAbrirSeletorDev,
  forcarFalhaMapa = false,
}) {
  const handlerBack = onBack || aoVoltar || (() => {})
  const handlerOpenLine = onOpenLine || aoSelecionarLinha || (() => {})
  const initialFocus = initialLine || linhaProp?.numero || null

  const [paradaInterna, setParadaInterna] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [previsoesPorLinha, setPrevisoesPorLinha] = useState({})
  const [carregandoLinhas, setCarregandoLinhas] = useState(true)
  const [focusLine, setFocusLine] = useState(initialFocus)
  const itemAtivoRef = useRef(null)

  useEffect(() => {
    if (focusLine && itemAtivoRef.current) {
      itemAtivoRef.current.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      })
    }
  }, [focusLine])

  const paradaAtiva = paradaProp || paradaInterna

  // 1. Carrega dados do totem/parada caso não fornecido via props
  useEffect(() => {
    let ativo = true
    if (!paradaProp) {
      obterTotem()
        .then((dados) => {
          if (ativo && dados?.parada) {
            setParadaInterna(dados.parada)
          }
        })
        .catch(() => {})
    }
    return () => {
      ativo = false
    }
  }, [paradaProp])

  // 2. Carrega as linhas que atendem a parada e suas previsões em tempo real do backend
  useEffect(() => {
    let ativo = true

    async function carregarLinhasEPrevisoes() {
      setCarregandoLinhas(true)
      try {
        const dadosLinhas = await listarLinhas()
        if (!ativo || !Array.isArray(dadosLinhas)) return

        // Busca previsões reais para cada linha da parada
        const mapaPrevisoes = {}
        await Promise.all(
          dadosLinhas.map(async (l) => {
            const idLinha = l.numero || String(l.codigo)
            if (!l.codigo) {
              mapaPrevisoes[idLinha] = {
                minutos: null,
                texto: 'Sem previsão',
              }
              return
            }

            try {
              const dadosPrev = await obterPrevisoes(l.codigo)
              const primeira = dadosPrev?.previsoes?.[0]
              if (primeira?.horario_previsto) {
                const minutos = calcularTempoEsperaMinutos(
                  primeira.horario_previsto,
                  dadosPrev.horario_referencia
                )
                mapaPrevisoes[idLinha] = {
                  minutos,
                  texto:
                    minutos === 0 || minutos === 1
                      ? 'Agora'
                      : minutos !== null
                        ? `${minutos} min`
                        : 'Sem previsão',
                }
              } else {
                mapaPrevisoes[idLinha] = {
                  minutos: null,
                  texto: 'Sem previsão',
                }
              }
            } catch {
              mapaPrevisoes[idLinha] = {
                minutos: null,
                texto: 'Sem previsão',
              }
            }
          })
        )

        if (!ativo) return
        setPrevisoesPorLinha(mapaPrevisoes)

        // Ordena linhas reais por tempo de chegada
        const ordenadas = [...dadosLinhas].sort((a, b) => {
          const idA = a.numero || String(a.codigo)
          const idB = b.numero || String(b.codigo)
          const minA = mapaPrevisoes[idA]?.minutos ?? Infinity
          const minB = mapaPrevisoes[idB]?.minutos ?? Infinity
          if (minA !== minB) return minA - minB
          return (a.numero || '').localeCompare(b.numero || '')
        })

        setLinhas(ordenadas)
      } catch {
        if (ativo) setLinhas([])
      } finally {
        if (ativo) setCarregandoLinhas(false)
      }
    }

    carregarLinhasEPrevisoes()

    return () => {
      ativo = false
    }
  }, [paradaAtiva?.codigo])

  const nomeParada = paradaAtiva?.nome || 'Localização do Totem'
  const enderecoParada =
    paradaAtiva?.endereco || 'Arredores da parada e localização do totem'
  const linhaSelecionada = focusLine
    ? linhas.find((l) => l.numero === focusLine) || { numero: focusLine }
    : null

  return (
    <section
      className="map-section map-screen tela-mapa"
      aria-labelledby="map-title"
      data-testid="secao-mapa-tela"
    >
      {/* 1. Cabeçalho com padrão do Figma */}
      <div className="section-header line-header mapa-header">
        <button
          type="button"
          className="action-button back-button"
          onClick={handlerBack}
          aria-label="Voltar para a tela anterior"
        >
          <span className="back-icon">
            <Icon name="arrow" size={20} />
          </span>
          Voltar
        </button>

        <div className="line-title-group">
          <div>
            <div className="section-label">
              <Icon name="map" size={19} /> Mapa da região
            </div>
            <h2 id="map-title">{nomeParada}</h2>
            <p className="map-header-subtitulo">{enderecoParada}</p>
          </div>
        </div>
      </div>

      {/* 2. Corpo da Tela: Mapa Leaflet à esquerda e Painel com Linhas Reais à direita */}
      <div className="map-body tela-mapa__body">
        {/* Mapa Real com Leaflet e OpenStreetMap */}
        <div className="map-canvas tela-mapa__canvas">
          <MapaDoPonto
            parada={paradaAtiva}
            emTelaCheia={true}
            aoAbrirSeletorDev={aoAbrirSeletorDev}
            forcarFalhaMapa={forcarFalhaMapa}
          />
        </div>

        {/* Painel Lateral com Dados Reais do Ponto e Linhas */}
        <aside
          className="map-detail tela-mapa__painel"
          aria-label="Informações sobre as linhas de ônibus"
        >
          {/* Linhas reais que atendem a parada */}
          <div className="stop-routes tela-mapa__linhas-bloco">
            <div className="stop-routes-head">
              <h4>Linhas que passam aqui</h4>
              {focusLine && (
                <button
                  type="button"
                  className="show-all-lines"
                  onClick={() => setFocusLine(null)}
                >
                  Mostrar todas
                </button>
              )}
            </div>

            {carregandoLinhas ? (
              <div className="tela-mapa__linhas-carregando" role="status">
                <span>Carregando linhas do ponto...</span>
              </div>
            ) : linhas.length === 0 ? (
              <p className="tela-mapa__linhas-vazio">
                Nenhuma linha encontrada para esta parada.
              </p>
            ) : (
              <ul className="tela-mapa__linhas-lista">
                {linhas.map((l) => {
                  const idLinha = l.numero || String(l.codigo)
                  const prev = previsoesPorLinha[idLinha]
                  const etaTexto = prev?.texto || 'Sem previsão'
                  const ehChegando =
                    prev?.minutos !== null &&
                    prev?.minutos !== undefined &&
                    prev?.minutos <= 3
                  const ativo = focusLine === l.numero

                  return (
                    <li key={l.codigo || l.numero}>
                      <button
                        ref={ativo ? itemAtivoRef : null}
                        type="button"
                        className={`route-item ${ativo ? 'active' : ''} ${
                          focusLine && !ativo ? 'dimmed' : ''
                        }`}
                        aria-pressed={ativo}
                        onClick={() =>
                          setFocusLine(ativo ? null : l.numero || l.codigo)
                        }
                      >
                        <span className="route-text">
                          <span
                            className={`tela-mapa__linha-badge tela-mapa__linha-badge--${
                              l.corBadge || 'vermelha'
                            }`}
                          >
                            {l.numero}
                          </span>
                          <span className="route-sentido">
                            Sentido {l.destino}
                          </span>
                        </span>
                        <span
                          className={`route-eta ${ehChegando ? 'soon' : ''}`}
                        >
                          {etaTexto}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Ação rápida para abrir a linha selecionada na TelaDetalheLinha */}
            {linhaSelecionada && (
              <button
                type="button"
                className="detail-cta"
                onClick={() => handlerOpenLine(linhaSelecionada)}
              >
                <span>Ver linha {linhaSelecionada.numero}</span>
                <span className="detail-cta__icon">
                  <Icon name="arrow" size={18} />
                </span>
              </button>
            )}
          </div>

          {/* Atalho para trocar parada no modo desenvolvedor */}
          {aoAbrirSeletorDev && (
            <button
              type="button"
              className="map-dev-btn"
              onClick={aoAbrirSeletorDev}
              aria-label="Trocar parada do totem no modo desenvolvedor"
            >
              Trocar parada (Dev)
            </button>
          )}
        </aside>
      </div>
    </section>
  )
}

export const MapSection = TelaMapa
export const MapaScreen = TelaMapa
