import { useState } from 'react'
import { CabecalhoTotem } from './componentes/layout/CabecalhoTotem'
import { TelaInicio } from './telas/TelaInicio'
import { TelaDetalheLinha } from './telas/TelaDetalheLinha'
import { TelaDemonstracao } from './telas/TelaDemonstracao'
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
