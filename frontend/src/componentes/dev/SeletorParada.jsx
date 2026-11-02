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
// Quanto rolar (em px de deltaY) para mudar um nível de zoom. Maior = zoom mais suave.
// Roda do mouse: cada clique manda cerca de 100 px, ou seja, ~0,6 nível
const PIXELS_POR_NIVEL_DE_ZOOM = 160
// Pinça do trackpad: o navegador manda a abertura dos dedos como fator e^(-deltaY/100);
// 1 seguiria os dedos exatamente, abaixo de 1 deixa o zoom mais lento que os dedos
const SENSIBILIDADE_DA_PINCA = 0.6

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
      zoomSnap: 0,
      zoomDelta: 0.5,
      // O zoom por rolagem do Leaflet descarta os eventos que chegam durante a
      // animação anterior; no trackpad isso perde quase todo o gesto (ver aoRolar)
      scrollWheelZoom: false,
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

    // Zoom pela roda e pelo trackpad, no mesmo caminho que o Leaflet usa para a
    // pinça em telas de toque (Map.TouchZoom): acumula o movimento, aplica uma vez
    // por quadro centrado no cursor e mantém as imagens do mapa esticadas até as
    // novas carregarem. Usa métodos internos do Leaflet 1.9 (_move, _moveStart,
    // _animateZoom), os mesmos do TouchZoom.
    let zoomPendente = 0
    let pontoDoZoom = null
    let quadro = 0
    let gestoAtivo = false
    let fimDoGesto = null

    function aplicarZoom() {
      quadro = 0
      const zoom = mapa._limitZoom(mapa.getZoom() + zoomPendente)
      zoomPendente = 0
      // O ponto do mapa sob o cursor continua sob o cursor depois do zoom
      const ancora = mapa.containerPointToLatLng(pontoDoZoom)
      const deslocamento = pontoDoZoom.subtract(mapa.getSize().divideBy(2))
      const centro = mapa.unproject(
        mapa.project(ancora, zoom).subtract(deslocamento),
        zoom
      )
      if (!gestoAtivo) {
        mapa._stop()
        mapa._moveStart(true, false)
        gestoAtivo = true
      }
      mapa._move(centro, zoom, { pinch: true, round: false })
    }

    function terminarGesto() {
      if (quadro) {
        cancelAnimationFrame(quadro)
        aplicarZoom()
      }
      if (!gestoAtivo) return
      gestoAtivo = false
      mapa._animateZoom(
        mapa.getCenter(),
        mapa._limitZoom(mapa.getZoom()),
        true,
        mapa.options.zoomSnap
      )
    }

    function aoRolar(evento) {
      evento.preventDefault()
      const escala =
        evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? 800 : 1
      const pixels = evento.deltaY * escala
      // ctrlKey indica a pinça do trackpad; sem ele é rolagem (roda ou dois dedos)
      zoomPendente -= evento.ctrlKey
        ? (pixels * SENSIBILIDADE_DA_PINCA) / (100 * Math.LN2)
        : pixels / PIXELS_POR_NIVEL_DE_ZOOM
      pontoDoZoom = mapa.mouseEventToContainerPoint(evento)
      if (!quadro) quadro = requestAnimationFrame(aplicarZoom)
      clearTimeout(fimDoGesto)
      fimDoGesto = setTimeout(terminarGesto, 150)
    }

    const container = mapa.getContainer()
    container.addEventListener('wheel', aoRolar, { passive: false })

    // Busca só quando o mapa para de se mexer, não a cada passo do zoom
    mapa.on('movestart', () => clearTimeout(espera))
    mapa.on('moveend', () => {
      clearTimeout(espera)
      espera = setTimeout(carregarParadas, 150)
    })
    carregarParadas()
    return () => {
      clearTimeout(espera)
      clearTimeout(fimDoGesto)
      cancelAnimationFrame(quadro)
      container.removeEventListener('wheel', aoRolar)
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
