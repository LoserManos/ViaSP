import { useState } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { VisualizacaoFigma } from '../componentes/totem/VisualizacaoFigma'
import { TOKENS } from '../tokens'
import './TelaDemonstracao.css'

/**
 * Página de demonstração e documentação dos design tokens e componentes base (ISS-14.4).
 *
 * @param {object} props
 * @param {() => void} props.aoVoltar - Callback para voltar à tela principal.
 */
export function TelaDemonstracao({ aoVoltar }) {
  const [cliques, setCliques] = useState(0)
  const [ultimoCartaoClicado, setUltimoCartaoClicado] = useState(null)
  const [linhaSelecionadaFigma, setLinhaSelecionadaFigma] = useState(null)

  return (
    <div className="viasp-demonstracao">
      <header className="viasp-demonstracao__topo">
        <Botao
          variante="voltar"
          onClick={aoVoltar}
          ariaLabel="Voltar para a tela inicial"
        >
          Voltar
        </Botao>
        <div>
          <TextoGrande as="h1" variante="titulo">
            Identidade Visual e Componentes Base
          </TextoGrande>
          <TextoGrande variante="corpo" cor="secundario">
            Baseado no protótipo Figma (viaSP) — alvos de toque ≥ 64px e
            conformidade WCAG AA.
          </TextoGrande>
        </div>
      </header>

      {/* Seção Principal: Mockup Fiel ao Protótipo do Figma */}
      <section className="viasp-demonstracao__secao">
        <TextoGrande as="h2" variante="subtitulo">
          1. Interface Baseada no Protótipo do Figma
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          Interface em modo quiosque com cabeçalho, barra de busca, botão de voz
          e linhas atendidas:
        </TextoGrande>
        <VisualizacaoFigma
          onSelecionarLinha={(linha) =>
            setLinhaSelecionadaFigma(linha.numero + ' — ' + linha.destino)
          }
        />
        {linhaSelecionadaFigma && (
          <Cartao destaque>
            <TextoGrande variante="destaque" cor="primaria" peso="bold">
              Toque registrado na linha: {linhaSelecionadaFigma}
            </TextoGrande>
          </Cartao>
        )}
      </section>

      {/* Seção 2: Indicador de Alvo de Toque */}
      <section className="viasp-demonstracao__secao">
        <TextoGrande as="h2" variante="subtitulo">
          2. Ergonomia de Toque (Mínimo de 64 px)
        </TextoGrande>
        <Cartao destaque>
          <div className="viasp-demonstracao__regua-toque">
            <div className="viasp-demonstracao__caixa-toque">
              <span className="viasp-demonstracao__medida">64 px</span>
            </div>
            <div>
              <TextoGrande variante="destaque" peso="bold">
                Alvo de toque mínimo: {TOKENS.alvoToqueMinimoPx} px
              </TextoGrande>
              <TextoGrande variante="corpo" cor="secundario">
                Garante acessibilidade para passageiros idosos (Fátima), pessoas
                com tremores motores ou usando luvas no ponto de ônibus.
              </TextoGrande>
            </div>
          </div>
        </Cartao>
      </section>

      {/* Seção 3: Componente Botao */}
      <section className="viasp-demonstracao__secao">
        <TextoGrande as="h2" variante="subtitulo">
          3. Componente: Botao
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          Cliques registrados no teste interativo: <strong>{cliques}</strong>
        </TextoGrande>

        <div className="viasp-demonstracao__grade-botoes">
          <Botao variante="primario" onClick={() => setCliques((c) => c + 1)}>
            Botão Primário (viaSP)
          </Botao>

          <Botao variante="secundario" onClick={() => setCliques((c) => c + 1)}>
            Botão Secundário
          </Botao>

          <Botao variante="voltar" onClick={() => setCliques((c) => c + 1)}>
            Botão de Voltar
          </Botao>

          <Botao variante="perigo" onClick={() => setCliques((c) => c + 1)}>
            Botão de Perigo / Alerta
          </Botao>

          <Botao
            variante="primario"
            tamanho="grande"
            onClick={() => setCliques((c) => c + 1)}
          >
            Botão Grande (72 px)
          </Botao>

          <Botao
            variante="primario"
            desabilitado
            onClick={() => setCliques((c) => c + 1)}
          >
            Botão Desabilitado
          </Botao>
        </div>
      </section>

      {/* Seção 4: Componente Cartao */}
      <section className="viasp-demonstracao__secao">
        <TextoGrande as="h2" variante="subtitulo">
          4. Componente: Cartao
        </TextoGrande>
        <div className="viasp-demonstracao__grade-cartoes">
          <Cartao>
            <TextoGrande variante="destaque" peso="bold">
              Cartão Informativo Estático
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Utilizado para agrupar dados como previsões e detalhes da linha
              com alto contraste visual.
            </TextoGrande>
          </Cartao>

          <Cartao
            destaque
            onClick={() => setUltimoCartaoClicado('Cartão com Destaque')}
            ariaLabel="Cartão com destaque interativo"
          >
            <TextoGrande variante="destaque" cor="primaria" peso="bold">
              Cartão Interativo com Destaque (Toque aqui)
            </TextoGrande>
            <TextoGrande variante="corpo">
              Bordas reforçadas em vermelho institucional viaSP e feedback tátil
              ao toque.
            </TextoGrande>
          </Cartao>

          <Cartao
            onClick={() => setUltimoCartaoClicado('Cartão Clicável Padrão')}
            ariaLabel="Cartão interativo padrão"
          >
            <TextoGrande variante="destaque" peso="bold">
              Cartão Clicável (Toque aqui)
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              Transforma-se em elemento de navegação com semântica de botão e
              acessibilidade de teclado.
            </TextoGrande>
          </Cartao>
        </div>
        {ultimoCartaoClicado && (
          <TextoGrande
            variante="corpo"
            cor="sucesso"
            peso="bold"
            className="viasp-demonstracao__aviso"
          >
            Último toque registrado: {ultimoCartaoClicado}
          </TextoGrande>
        )}
      </section>

      {/* Seção 5: Componente TextoGrande e Tipografia */}
      <section className="viasp-demonstracao__secao">
        <TextoGrande as="h2" variante="subtitulo">
          5. Componente: TextoGrande (Escala Tipográfica)
        </TextoGrande>
        <Cartao>
          <div className="viasp-demonstracao__amostras-texto">
            <div>
              <TextoGrande variante="pequeno" cor="secundario">
                Display (44px / Bold)
              </TextoGrande>
              <TextoGrande as="h1" variante="display">
                8012-10 Butantã
              </TextoGrande>
            </div>

            <div>
              <TextoGrande variante="pequeno" cor="secundario">
                Título (32px / Bold)
              </TextoGrande>
              <TextoGrande as="h2" variante="titulo">
                Linhas do Ponto de Ônibus
              </TextoGrande>
            </div>

            <div>
              <TextoGrande variante="pequeno" cor="secundario">
                Subtítulo (24px / Semibold)
              </TextoGrande>
              <TextoGrande as="h3" variante="subtitulo">
                Previsão de Chegada em Tempo Real
              </TextoGrande>
            </div>

            <div>
              <TextoGrande variante="pequeno" cor="secundario">
                Destaque (20px / Medium)
              </TextoGrande>
              <TextoGrande variante="destaque">
                Próximo ônibus previsto em 4 minutos (19:35)
              </TextoGrande>
            </div>

            <div>
              <TextoGrande variante="pequeno" cor="secundario">
                Corpo Padrão (18px / Regular)
              </TextoGrande>
              <TextoGrande variante="corpo">
                Texto de corpo legível a 1-2 metros de distância na tela
                pública.
              </TextoGrande>
            </div>

            <div className="viasp-demonstracao__cores-texto">
              <TextoGrande variante="destaque" cor="primaria" peso="bold">
                Texto Primário (viaSP)
              </TextoGrande>
              <TextoGrande variante="destaque" cor="sucesso" peso="bold">
                Texto de Sucesso
              </TextoGrande>
              <TextoGrande variante="destaque" cor="alerta" peso="bold">
                Texto de Alerta
              </TextoGrande>
              <TextoGrande variante="destaque" cor="erro" peso="bold">
                Texto de Erro
              </TextoGrande>
            </div>
          </div>
        </Cartao>
      </section>
    </div>
  )
}
