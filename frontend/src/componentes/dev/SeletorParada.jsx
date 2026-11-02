import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Botao, TextoGrande } from '../base'
import { Icone } from '../comuns/Icone'
import { escolherParada, listarParadasNaArea } from '../../servicos/api'
import './SeletorParada.css'

// Abaixo desse zoom a área visível tem milhares de paradas: pede para aproximar
const ZOOM_MINIMO_PARADAS = 15
const CENTRO_SAO_PAULO = [-23.5505, -46.6333]

const ESTILO_PARADA = {
  radius: 7,
  color: '#ffffff',
  weight: 2,
  fillColor: '#2563eb',
  fillOpacity: 0.9,
}
const ESTILO_SELECIONADA = {
  ...ESTILO_PARADA,
  radius: 10,
  fillColor: '#e5273f',
}

/**
 * Modo dev: mapa com as paradas do GTFS para escolher onde o totem está.
 * Não faz parte do totem final, em que a parada é fixa na configuração.
 *
 * @param {object} props
 * @param {{codigo: number, latitude: number, longitude: number} | null} props.paradaAtual
 * @param {(totem: object) => void} props.aoEscolher - Recebe o totem já com a parada nova.
 * @param {() => void} props.aoFechar
 */
export function SeletorParada({ paradaAtual, aoEscolher, aoFechar }) {
  const elementoMapa = useRef(null)
  const [selecionada, setSelecionada] = useState(paradaAtual)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const temPosicao = paradaAtual?.latitude && paradaAtual?.longitude
    const mapa = L.map(elementoMapa.current, {
      // Zoom contínuo, como no Google Maps: a roda e a pinça não saltam de nível em nível
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 60,
      wheelDebounceTime: 20,
    }).setView(
      temPosicao
        ? [paradaAtual.latitude, paradaAtual.longitude]
        : CENTRO_SAO_PAULO,
      temPosicao ? 17 : 12
    )
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa)

    const camada = L.layerGroup().addTo(mapa)
    // Marcadores por código: um movimento do mapa só adiciona e remove a diferença,
    // em vez de apagar e redesenhar tudo (o que fazia os pontos piscarem)
    const marcadores = new Map()
    let codigoSelecionado = paradaAtual?.codigo
    let requisicao = 0
    let espera = null

    function selecionar(parada) {
      marcadores.get(codigoSelecionado)?.setStyle(ESTILO_PARADA)
      codigoSelecionado = parada.codigo
      marcadores.get(parada.codigo)?.setStyle(ESTILO_SELECIONADA).bringToFront()
      setSelecionada(parada)
    }

    function limparMarcadores() {
      camada.clearLayers()
      marcadores.clear()
    }

    async function carregarParadas() {
      const atual = ++requisicao
      if (mapa.getZoom() < ZOOM_MINIMO_PARADAS) {
        limparMarcadores()
        setAviso('Aproxime o mapa para ver as paradas.')
        return
      }
      // Margem em volta da área visível: arrastar um pouco não deixa bordas vazias
      const limites = mapa.getBounds().pad(0.3)
      try {
        const { paradas, truncado } = await listarParadasNaArea(
          {
            latMin: limites.getSouth(),
            latMax: limites.getNorth(),
            lonMin: limites.getWest(),
            lonMax: limites.getEast(),
          },
          1500
        )
        // Uma resposta antiga não sobrescreve a de uma área mais nova
        if (atual !== requisicao) return

        const visiveis = new Set(paradas.map((parada) => parada.codigo))
        for (const [codigo, marcador] of marcadores) {
          if (!visiveis.has(codigo)) {
            camada.removeLayer(marcador)
            marcadores.delete(codigo)
          }
        }
        for (const parada of paradas) {
          if (marcadores.has(parada.codigo)) continue
          const marcador = L.circleMarker(
            [parada.latitude, parada.longitude],
            parada.codigo === codigoSelecionado
              ? ESTILO_SELECIONADA
              : ESTILO_PARADA
          )
            .on('click', () => selecionar(parada))
            .bindTooltip(parada.nome)
            .addTo(camada)
          marcadores.set(parada.codigo, marcador)
        }
        marcadores.get(codigoSelecionado)?.bringToFront()
        setAviso(
          truncado ? 'Há mais paradas nesta área: aproxime para ver todas.' : ''
        )
        setErro('')
      } catch (e) {
        if (atual === requisicao) setErro(e.mensagem || 'Falha ao carregar.')
      }
    }

    // Busca só quando o mapa para de se mexer, não a cada passo do zoom
    mapa.on('movestart', () => clearTimeout(espera))
    mapa.on('moveend', () => {
      clearTimeout(espera)
      espera = setTimeout(carregarParadas, 150)
    })
    carregarParadas()
    return () => {
      clearTimeout(espera)
      mapa.remove()
    }
  }, [paradaAtual])

  async function confirmar() {
    setSalvando(true)
    try {
      aoEscolher(await escolherParada(selecionada.codigo))
    } catch (e) {
      setErro(e.mensagem || 'Não foi possível trocar a parada.')
      setSalvando(false)
    }
  }

  return (
    <div
      className="viasp-seletor-parada"
      role="dialog"
      aria-modal="true"
      aria-label="Escolher a parada do totem"
    >
      <div className="viasp-seletor-parada__topo">
        <div>
          <TextoGrande as="h2" variante="subtitulo" peso="bold">
            Escolher parada
          </TextoGrande>
          <TextoGrande variante="pequeno" cor="secundario">
            Modo dev: toque numa parada do mapa. Vale até o backend reiniciar.
          </TextoGrande>
        </div>
        <button
          type="button"
          className="viasp-seletor-parada__fechar"
          onClick={aoFechar}
          aria-label="Fechar seletor de parada"
        >
          <Icone nome="fechar" tamanho="1.5rem" />
        </button>
      </div>

      <div className="viasp-seletor-parada__mapa-area">
        <div ref={elementoMapa} className="viasp-seletor-parada__mapa" />
        {(erro || aviso) && (
          <div
            className={`viasp-seletor-parada__aviso${erro ? ' viasp-seletor-parada__aviso--erro' : ''}`}
            role="status"
          >
            {erro || aviso}
          </div>
        )}
      </div>

      <div className="viasp-seletor-parada__rodape">
        <div className="viasp-seletor-parada__escolhida">
          {selecionada ? (
            <>
              <TextoGrande variante="destaque" peso="bold">
                {selecionada.nome || `Parada ${selecionada.codigo}`}
              </TextoGrande>
              <TextoGrande variante="pequeno" cor="secundario">
                {[selecionada.endereco, `código ${selecionada.codigo}`]
                  .filter(Boolean)
                  .join(' · ')}
              </TextoGrande>
            </>
          ) : (
            <TextoGrande variante="corpo" cor="secundario">
              Nenhuma parada selecionada.
            </TextoGrande>
          )}
        </div>
        <Botao
          onClick={confirmar}
          desabilitado={
            !selecionada ||
            salvando ||
            selecionada.codigo === paradaAtual?.codigo
          }
        >
          {salvando ? 'Trocando...' : 'Usar esta parada'}
        </Botao>
      </div>
    </div>
  )
}
