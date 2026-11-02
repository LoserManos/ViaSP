import { useEffect, useState } from 'react'
import { CabecalhoTotem } from './componentes/layout/CabecalhoTotem'
import { TelaInicio } from './telas/TelaInicio'
import { TelaDetalheLinha } from './telas/TelaDetalheLinha'
import { TelaDemonstracao } from './telas/TelaDemonstracao'
import { obterTotem } from './servicos/api'
import './App.css'

/**
 * Componente principal do Totem com navegação por estado (ISS-14.2).
 * Como o totem opera em modo quiosque (tela cheia sem barra de endereços),
 * a navegação não utiliza rotas por URL, e sim uma máquina de estados com
 * botão de voltar sempre acessível.
 */
function App() {
  const [navegacao, setNavegacao] = useState({
    tela: 'inicio', // 'inicio' | 'detalhe' | 'demo'
    params: {},
  })
  const [parada, setParada] = useState(null)

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

  const irParaDemo = () => {
    setNavegacao({ tela: 'demo', params: {} })
  }

  return (
    <div className="viasp-app">
      {/* Cabeçalho fixo do totem com botão voltar condicional */}
      <CabecalhoTotem
        nomeParada={
          parada && [parada.nome, parada.endereco].filter(Boolean).join(' — ')
        }
        aoVoltar={navegacao.tela !== 'inicio' ? irParaInicio : undefined}
        aoAbrirDemo={navegacao.tela !== 'demo' ? irParaDemo : undefined}
        tituloTela={
          navegacao.tela === 'detalhe'
            ? `Linha ${navegacao.params?.linha?.numero || ''}`
            : navegacao.tela === 'demo'
              ? 'Design Tokens'
              : undefined
        }
      />

      {/* Conteúdo dinâmico renderizado de acordo com o estado ativo */}
      <main className="viasp-app__conteudo">
        {navegacao.tela === 'inicio' && (
          <TelaInicio
            aoSelecionarLinha={irParaDetalhe}
            aoAbrirDemo={irParaDemo}
          />
        )}

        {navegacao.tela === 'detalhe' && (
          <TelaDetalheLinha
            linha={navegacao.params?.linha}
            aoVoltar={irParaInicio}
          />
        )}

        {navegacao.tela === 'demo' && (
          <TelaDemonstracao aoVoltar={irParaInicio} />
        )}
      </main>
    </div>
  )
}

export default App
