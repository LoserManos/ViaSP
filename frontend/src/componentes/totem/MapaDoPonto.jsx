import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Cartao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import { obterTotem } from '../../servicos/api'
import './MapaDoPonto.css'

const ZOOM_FIXO_PONTO = 17
const URL_TILES_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUICAO_OSM =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

/**
 * Verifica se a parada possui coordenadas geográficas válidas para exibição no mapa.
 * No contrato do backend (ISS-13.3), coordenadas (0, 0) indicam ausência de geolocalização.
 *
 * @param {object | null | undefined} parada
 * @returns {boolean}
 */
function temCoordenadasValidas(parada) {
  if (!parada) return false
  const { latitude, longitude } = parada
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    (latitude !== 0 || longitude !== 0)
  )
}

function escaparHtml(texto = '') {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Componente de mapa contínuo com a localização do ponto de ônibus (ISS-19 / US05).
 *
 * - ISS-19.1: Utiliza Leaflet (BSD-2-Clause) com tiles do OpenStreetMap (ODbL).
 * - ISS-19.2: Centrado nas coordenadas de `/api/totem`, com zoom fixo (17) e
 *   todos os gestos de navegação desabilitados para não tirar o ponto de vista.
 * - ISS-19.3: Em caso de falha de rede no carregamento dos tiles, erro na API
 *   ou coordenadas ausentes, exibe fallback claro com o endereço do ponto em texto.
 *
 * @param {object} props
 * @param {{codigo?: number, nome?: string, endereco?: string, latitude?: number, longitude?: number} | null} [props.parada]
 * @param {boolean} [props.expandido=false] - Exibe o mapa com área ampliada.
 * @param {() => void} [props.aoAlternarExpandido] - Alterna entre visualização compacta e ampliada.
 * @param {() => void} [props.aoAbrirSeletorDev] - Atalho opcional para o seletor de parada no modo dev.
 * @param {boolean} [props.forcarFalhaMapa=false] - Permite simular falha de carregamento do mapa.
 */
export function MapaDoPonto({
  parada: paradaProp,
  expandido = false,
  aoAlternarExpandido,
  aoAbrirSeletorDev,
  forcarFalhaMapa = false,
}) {
  const elementoMapa = useRef(null)
  const instanciaMapaRef = useRef(null)
  const [paradaInterna, setParadaInterna] = useState(null)
  const [buscaConcluida, setBuscaConcluida] = useState(false)
  const [falhaMapa, setFalhaMapa] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  const paradaAtiva = paradaProp || paradaInterna
  const carregandoTotem = !paradaProp && !buscaConcluida

  // Se a parada não foi passada via prop, busca diretamente de /api/totem
  useEffect(() => {
    if (paradaProp) {
      return undefined
    }

    let ativo = true

    obterTotem()
      .then((dadosTotem) => {
        if (!ativo) return
        if (dadosTotem?.parada) {
          setParadaInterna(dadosTotem.parada)
        } else {
          setFalhaMapa(true)
        }
        setBuscaConcluida(true)
      })
      .catch(() => {
        if (ativo) {
          setFalhaMapa(true)
          setBuscaConcluida(true)
        }
      })

    return () => {
      ativo = false
    }
  }, [paradaProp, tentativa])

  const coordenadasOk = temCoordenadasValidas(paradaAtiva)
  const exibirFallback =
    Boolean(forcarFalhaMapa) ||
    falhaMapa ||
    (!carregandoTotem && !coordenadasOk)

  const latitude = paradaAtiva?.latitude
  const longitude = paradaAtiva?.longitude
  const nomeParada = paradaAtiva?.nome

  useEffect(() => {
    if (exibirFallback || !coordenadasOk || !elementoMapa.current) {
      return undefined
    }

    const nomeSeguro = escaparHtml(nomeParada || 'Ponto de Ônibus')

    const mapa = L.map(elementoMapa.current, {
      center: [latitude, longitude],
      zoom: ZOOM_FIXO_PONTO,
      minZoom: ZOOM_FIXO_PONTO,
      maxZoom: ZOOM_FIXO_PONTO,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      attributionControl: true,
    })

    // Garante que nenhum handler de gesto tire o ponto de vista (ISS-19.2)
    mapa.dragging?.disable()
    mapa.touchZoom?.disable()
    mapa.doubleClickZoom?.disable()
    mapa.scrollWheelZoom?.disable()
    mapa.boxZoom?.disable()
    mapa.keyboard?.disable()

    mapa.setView([latitude, longitude], ZOOM_FIXO_PONTO, { animate: false })

    const camadaTiles = L.tileLayer(URL_TILES_OSM, {
      minZoom: ZOOM_FIXO_PONTO,
      maxZoom: ZOOM_FIXO_PONTO,
      attribution: ATRIBUICAO_OSM,
    })

    // ISS-19.3: Em caso de falha de rede ao carregar os tiles, ativa o fallback em texto
    camadaTiles.on('tileerror', () => {
      setFalhaMapa(true)
    })

    camadaTiles.addTo(mapa)

    // ISS-19.2: Marcador grande, de alto contraste e legível no ponto do totem
    const iconeMarcador = L.divIcon({
      className: 'viasp-mapa-ponto__marcador-wrapper',
      iconSize: [240, 88],
      iconAnchor: [120, 76],
      html: `
        <div class="viasp-mapa-ponto__marcador" data-testid="marcador-ponto-onibus">
          <div class="viasp-mapa-ponto__marcador-rotulo">
            <span class="viasp-mapa-ponto__marcador-tag">LOCAL DO TOTEM</span>
            <strong class="viasp-mapa-ponto__marcador-nome">${nomeSeguro}</strong>
          </div>
          <div class="viasp-mapa-ponto__marcador-pino-area">
            <span class="viasp-mapa-ponto__marcador-pulso" aria-hidden="true"></span>
            <span class="viasp-mapa-ponto__marcador-pino" aria-hidden="true">
              <span class="viasp-mapa-ponto__marcador-pino-centro"></span>
            </span>
          </div>
        </div>
      `,
    })

    L.marker([latitude, longitude], {
      icon: iconeMarcador,
      interactive: false,
      keyboard: false,
      title: `Localização do ponto: ${nomeParada || 'Ponto de Ônibus'}`,
      alt: `Marcador da parada ${nomeParada || 'Ponto de Ônibus'}`,
    }).addTo(mapa)

    instanciaMapaRef.current = mapa

    return () => {
      mapa.remove()
      instanciaMapaRef.current = null
    }
  }, [
    exibirFallback,
    coordenadasOk,
    latitude,
    longitude,
    nomeParada,
    tentativa,
  ])

  // Redimensiona o canvas do Leaflet quando o estado expandido muda
  useEffect(() => {
    if (instanciaMapaRef.current && coordenadasOk && !exibirFallback) {
      instanciaMapaRef.current.invalidateSize?.()
      instanciaMapaRef.current.setView([latitude, longitude], ZOOM_FIXO_PONTO, {
        animate: false,
      })
    }
  }, [expandido, coordenadasOk, exibirFallback, latitude, longitude])

  const tentarNovamente = () => {
    setFalhaMapa(false)
    if (!paradaProp) {
      setBuscaConcluida(false)
    }
    setTentativa((t) => t + 1)
  }

  const enderecoTexto =
    paradaAtiva?.endereco ||
    paradaAtiva?.nome ||
    'Endereço do ponto indisponível no momento'

  return (
    <section
      className={`viasp-mapa-ponto ${expandido ? 'viasp-mapa-ponto--expandido' : ''}`}
      aria-label="Mapa com a localização do ponto de ônibus"
      data-testid="secao-mapa-do-ponto"
    >
      <Cartao className="viasp-mapa-ponto__cartao">
        <div className="viasp-mapa-ponto__cabecalho">
          <div className="viasp-mapa-ponto__cabecalho-info">
            <div className="viasp-mapa-ponto__icone-box" aria-hidden="true">
              <Icone nome="mapa" tamanho="1.5rem" />
            </div>
            <div>
              <div className="viasp-mapa-ponto__eyebrow">
                <span className="viasp-mapa-ponto__eyebrow-dot" />
                <span>LOCALIZAÇÃO DO PONTO • ARREDORES</span>
              </div>
              <TextoGrande as="h2" variante="subtitulo" peso="bold">
                Mapa dos arredores deste ponto
              </TextoGrande>
            </div>
          </div>

          <div className="viasp-mapa-ponto__acoes">
            <span
              className="viasp-mapa-ponto__badge-fixo"
              title="Visão travada no ponto de ônibus"
            >
              Visão fixa no ponto
            </span>

            {aoAbrirSeletorDev && (
              <button
                type="button"
                className="viasp-mapa-ponto__btn-acao viasp-mapa-ponto__btn-dev"
                onClick={aoAbrirSeletorDev}
                aria-label="Trocar parada do totem no modo desenvolvedor"
              >
                Trocar parada (Dev)
              </button>
            )}

            {aoAlternarExpandido && (
              <button
                type="button"
                className="viasp-mapa-ponto__btn-acao"
                onClick={aoAlternarExpandido}
                aria-expanded={expandido}
                aria-label={
                  expandido
                    ? 'Reduzir visualização do mapa'
                    : 'Ampliar visualização do mapa'
                }
              >
                {expandido ? 'Reduzir mapa' : 'Ampliar mapa'}
              </button>
            )}
          </div>
        </div>

        {exibirFallback ? (
          <div
            className="viasp-mapa-ponto__fallback"
            role="status"
            data-testid="mapa-ponto-fallback"
          >
            <div
              className="viasp-mapa-ponto__fallback-icone"
              aria-hidden="true"
            >
              <Icone nome="localizacao" tamanho="2rem" />
            </div>
            <div className="viasp-mapa-ponto__fallback-conteudo">
              <span className="viasp-mapa-ponto__fallback-aviso">
                Mapa indisponível no momento — localização em texto:
              </span>
              {paradaAtiva?.nome && (
                <TextoGrande
                  variante="destaque"
                  peso="bold"
                  className="viasp-mapa-ponto__fallback-nome"
                >
                  Ponto: {paradaAtiva.nome}
                </TextoGrande>
              )}
              <TextoGrande
                variante="corpo"
                className="viasp-mapa-ponto__fallback-endereco"
                data-testid="mapa-ponto-fallback-endereco"
              >
                Endereço: {enderecoTexto}
              </TextoGrande>
            </div>
            {!forcarFalhaMapa && (
              <button
                type="button"
                className="viasp-mapa-ponto__btn-acao"
                onClick={tentarNovamente}
                aria-label="Tentar carregar o mapa novamente"
              >
                Recarregar mapa
              </button>
            )}
          </div>
        ) : (
          <div className="viasp-mapa-ponto__moldura">
            <div
              ref={elementoMapa}
              className="viasp-mapa-ponto__canvas"
              data-testid="mapa-ponto-canvas"
              aria-label={`Mapa centrado no ponto ${paradaAtiva?.nome || ''}`}
            />
            <div className="viasp-mapa-ponto__legenda-rodape">
              <div className="viasp-mapa-ponto__legenda-item">
                <span
                  className="viasp-mapa-ponto__legenda-pino"
                  aria-hidden="true"
                />
                <span>
                  <strong>Ponto atual:</strong>{' '}
                  {paradaAtiva?.endereco || paradaAtiva?.nome}
                </span>
              </div>
              {coordenadasOk && (
                <span className="viasp-mapa-ponto__coordenadas">
                  {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>
        )}
      </Cartao>
    </section>
  )
}
