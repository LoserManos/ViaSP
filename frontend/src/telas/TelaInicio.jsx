import { useState, useEffect } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { MensagemErro } from '../componentes/feedback/MensagemErro'
import { obterTotem, listarLinhas } from '../servicos/api'
import './TelaInicio.css'

/**
 * Tela Inicial do Totem (US01 / ISS-15).
 *
 * @param {object} props
 * @param {(linha: object) => void} props.aoSelecionarLinha - Disparado ao selecionar uma linha.
 * @param {() => void} [props.aoAbrirDemo] - Navegação para demonstração de tokens.
 */
export function TelaInicio({ aoSelecionarLinha, aoAbrirDemo }) {
  const [totem, setTotem] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [termoBusca, setTermoBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregarDados = async (termo = '') => {
    setCarregando(true)
    setErro(null)
    try {
      const [dadosTotem, dadosLinhas] = await Promise.all([
        obterTotem(),
        listarLinhas(termo),
      ])
      setTotem(dadosTotem)
      setLinhas(dadosLinhas)
    } catch (err) {
      setErro(err.mensagem || 'Falha ao carregar as linhas da parada.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function buscar() {
      try {
        const [dadosTotem, dadosLinhas] = await Promise.all([
          obterTotem(),
          listarLinhas(termoBusca),
        ])
        if (ativo) {
          setTotem(dadosTotem)
          setLinhas(dadosLinhas)
        }
      } catch (err) {
        if (ativo) {
          setErro(err.mensagem || 'Falha ao carregar as linhas da parada.')
        }
      } finally {
        if (ativo) {
          setCarregando(false)
        }
      }
    }

    buscar()

    return () => {
      ativo = false
    }
  }, [termoBusca])

  return (
    <div className="viasp-tela-inicio">
      {/* Hero do Figma */}
      <section className="viasp-tela-inicio__hero">
        <span className="viasp-tela-inicio__tag">
          TRANSPORTE PÚBLICO • SÃO PAULO
        </span>
        <TextoGrande as="h1" variante="display">
          Olá! Aonde vamos?
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          Selecione uma linha abaixo para conferir itinerário e previsões em
          tempo real:
        </TextoGrande>
      </section>

      {/* Barra de Busca Rápida por Toque */}
      <section className="viasp-tela-inicio__busca-box">
        <div className="viasp-tela-inicio__busca-campo-wrapper">
          <span className="viasp-tela-inicio__busca-icone" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="viasp-tela-inicio__busca-input"
            placeholder="Qual linha você procura? Digite número ou destino..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            aria-label="Buscar linha por número ou destino"
          />
          {termoBusca && (
            <button
              type="button"
              className="viasp-tela-inicio__busca-limpar"
              onClick={() => setTermoBusca('')}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>
      </section>

      {/* Estado de Erro */}
      {erro && (
        <MensagemErro
          mensagem={erro}
          aoTentarNovamente={() => carregarDados(termoBusca)}
        />
      )}

      {/* Cartão Informativo da Parada */}
      {totem && (
        <Cartao className="viasp-tela-inicio__card-parada">
          <div className="viasp-tela-inicio__card-topo">
            <div>
              <div className="viasp-tela-inicio__tag-local">
                <span className="viasp-tela-inicio__dot-local" />
                <span>VOCÊ ESTÁ EM</span>
              </div>
              <TextoGrande as="h2" variante="titulo">
                {totem.parada.nome}
              </TextoGrande>
              <TextoGrande variante="corpo" cor="secundario">
                {totem.parada.endereco}
              </TextoGrande>
            </div>
            <div className="viasp-tela-inicio__badge-status">
              <span className="viasp-tela-inicio__dot-verde" />
              <span>Atualizado agora</span>
            </div>
          </div>
        </Cartao>
      )}

      {/* Lista de Linhas Atendidas */}
      <section className="viasp-tela-inicio__secao-linhas">
        <div className="viasp-tela-inicio__cabecalho-lista">
          <TextoGrande as="h2" variante="subtitulo">
            Linhas que passam neste ponto
          </TextoGrande>
          <TextoGrande variante="pequeno" cor="secundario">
            {linhas.length}{' '}
            {linhas.length === 1 ? 'linha disponível' : 'linhas disponíveis'}
          </TextoGrande>
        </div>

        {carregando ? (
          <div className="viasp-tela-inicio__carregando" role="status">
            <div className="viasp-tela-inicio__spinner" aria-hidden="true" />
            <TextoGrande variante="destaque">
              Carregando linhas do ponto...
            </TextoGrande>
          </div>
        ) : linhas.length === 0 ? (
          <Cartao>
            <TextoGrande variante="destaque" peso="bold">
              Nenhuma linha encontrada
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Tente outro número de linha ou limpe o campo de busca acima.
            </TextoGrande>
            {termoBusca && (
              <div style={{ marginTop: '16px' }}>
                <Botao variante="secundario" onClick={() => setTermoBusca('')}>
                  Limpar busca
                </Botao>
              </div>
            )}
          </Cartao>
        ) : (
          <div className="viasp-tela-inicio__grade-linhas">
            {linhas.map((linha) => (
              <Cartao
                key={linha.codigo}
                onClick={() => aoSelecionarLinha(linha)}
                className="viasp-tela-inicio__item-linha"
                ariaLabel={`Ver detalhes da linha ${linha.numero} com destino a ${linha.destino}`}
              >
                <div className="viasp-tela-inicio__linha-esquerda">
                  <div
                    className={`viasp-tela-inicio__badge-numero viasp-tela-inicio__badge-numero--${linha.corBadge || 'azul'}`}
                  >
                    🚌 {linha.numero}
                  </div>
                  <div className="viasp-tela-inicio__linha-info">
                    <TextoGrande variante="destaque" peso="bold">
                      {linha.destino}
                    </TextoGrande>
                    <TextoGrande variante="pequeno" cor="secundario">
                      Sentido: {linha.origem} → {linha.destino}
                    </TextoGrande>
                  </div>
                </div>

                <div className="viasp-tela-inicio__linha-direita">
                  <span className="viasp-tela-inicio__seta-acao">›</span>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </section>

      {/* Atalho para visualização de demonstração de tokens */}
      {aoAbrirDemo && (
        <footer className="viasp-tela-inicio__rodape">
          <Botao variante="secundario" onClick={aoAbrirDemo}>
            Ver Página de Demonstração (Design Tokens & Ergonomia)
          </Botao>
        </footer>
      )}
    </div>
  )
}
