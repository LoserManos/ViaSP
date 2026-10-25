import { TelaDemonstracao } from './telas/TelaDemonstracao'

function App() {
  return (
    <main>
      <TelaDemonstracao
        aoVoltar={() => alert('Você já está na tela de demonstração do totem!')}
      />
    </main>
  )
}

export default App
