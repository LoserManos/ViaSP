import { lazy, Suspense, useEffect, useState } from 'react'
import { CabecalhoTotem } from './componentes/layout/CabecalhoTotem'
import { RodapeTotem } from './componentes/layout/RodapeTotem'
import { TelaInicio } from './telas/TelaInicio'
import { TelaDetalheLinha } from './telas/TelaDetalheLinha'
import { TelaMapa } from './telas/TelaMapa'
import { estaUsandoMocks, obterTotem } from './servicos/api'
import './App.css'

// Modo dev: o mapa (Leaflet) só é baixado quando o seletor abre
const SeletorParada = lazy(() =>
  import('./componentes/dev/SeletorParada').then((m) => ({
    default: m.SeletorParada,
  }))
)

/**
 * Componente principal do Totem com navegação por estado (ISS-14.2).
 * Como o totem opera em modo quiosque (tela cheia sem barra de endereços),
 * a navegação não utiliza rotas por URL, e sim uma máquina de estados com
 * botão de voltar sempre acessível.
 */
function App() {
  const [navegacao, setNavegacao] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#mapa') {
      return { tela: 'mapa', params: {} }
    }
    return { tela: 'inicio', params: {} }
  })
  const [parada, setParada] = useState(null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  // Muda quando a parada é trocada no modo dev, para a tela inicial recarregar as linhas
  const [versaoParada, setVersaoParada] = useState(0)
  const modoDev = import.meta.env.DEV && !estaUsandoMocks()
  // Totem em pé (ex.: 1080×1920) usa layout vertical e escala maior
  const [retrato, setRetrato] = useState(false)

  // Escala a interface inteira conforme a resolução da tela, para que telas
  // grandes não fiquem com tudo pequeno. Referência: 1440×900 deitado e
  // 720×1280 em pé (1080×1920 → 1,5×). Nunca reduz abaixo de 1×.
  useEffect(() => {
    const atualizar = () => {
      const largura = window.innerWidth
      const altura = window.innerHeight
      const emPe = altura > largura && altura >= 1100
      const [refLargura, refAltura] = emPe ? [720, 1280] : [1440, 900]
      const escala = Math.min(
        Math.max(Math.min(largura / refLargura, altura / refAltura), 1),
        3
      )
      document.documentElement.style.setProperty(
        '--ui-escala',
        escala.toFixed(3)
      )
      setRetrato(emPe)
    }
    atualizar()
    window.addEventListener('resize', atualizar)
    return () => window.removeEventListener('resize', atualizar)
  }, [])

  // Nome da parada no cabeçalho vem do backend; se falhar, o logo mostra o subtítulo padrão
  useEffect(() => {
    let ativo = true
    obterTotem()
      .then((totem) => {
        if (ativo) setParada(totem.parada)
      })
      .catch(() => {})
    return () => {
      ativo = false
    }
  }, [])

  const irParaInicio = () => {
    setNavegacao({ tela: 'inicio', params: {} })
  }

  const irParaDetalhe = (linha) => {
    setNavegacao({ tela: 'detalhe', params: { linha } })
  }

  const irParaMapa = (origem = 'inicio') => {
    setNavegacao({
      tela: 'mapa',
      params: {
        origem,
        linha: navegacao.params?.linha,
      },
    })
  }

  const voltarDoMapa = () => {
    if (navegacao.params?.origem === 'detalhe' && navegacao.params?.linha) {
      irParaDetalhe(navegacao.params.linha)
    } else {
      irParaInicio()
    }
  }

  const trocarParada = (totem) => {
    setParada(totem.parada)
    setVersaoParada((versao) => versao + 1)
    setSeletorAberto(false)
    irParaInicio()
  }

  return (
    <>
      <div className="viasp-app">
        {/* Cabeçalho fixo do totem */}
        <CabecalhoTotem
          nomeParada={
            parada && [parada.nome, parada.endereco].filter(Boolean).join(' — ')
          }
        />

        {/* Conteúdo dinâmico renderizado de acordo com o estado ativo */}
        <main className="viasp-app__conteudo">
          {navegacao.tela === 'inicio' && (
            <TelaInicio
              key={versaoParada}
              retrato={retrato}
              aoSelecionarLinha={irParaDetalhe}
              aoAbrirMapa={() => irParaMapa('inicio')}
            />
          )}

          {navegacao.tela === 'detalhe' && (
            <TelaDetalheLinha
              linha={navegacao.params?.linha}
              aoVoltar={irParaInicio}
              aoAbrirMapa={() => irParaMapa('detalhe')}
            />
          )}

          {navegacao.tela === 'mapa' && (
            <TelaMapa
              parada={parada}
              linha={navegacao.params?.linha}
              initialLine={
                navegacao.params?.linha?.numero || navegacao.params?.initialLine
              }
              aoVoltar={voltarDoMapa}
              onBack={voltarDoMapa}
              onOpenLine={(code) =>
                irParaDetalhe(
                  typeof code === 'string'
                    ? { numero: code, codigo: code }
                    : code
                )
              }
              aoSelecionarLinha={(linha) => irParaDetalhe(linha)}
              aoAbrirSeletorDev={
                modoDev ? () => setSeletorAberto(true) : undefined
              }
            />
          )}
        </main>

        {/* Rodapé fixo com horário e dados em tempo real SPTrans */}
        <RodapeTotem />
      </div>

      {/* Fora de .viasp-app: o Leaflet erra a posição dos cliques sob CSS zoom */}
      {seletorAberto && (
        <Suspense fallback={null}>
          <SeletorParada
            paradaAtual={parada}
            aoEscolher={trocarParada}
            aoFechar={() => setSeletorAberto(false)}
          />
        </Suspense>
      )}
    </>
  )
}

export default App
