import { useState, useEffect } from 'react'
import { Botao, Cartao, TextoGrande } from '../componentes/base'
import { Icone } from '../componentes/comuns/Icone'
import { MensagemErro } from '../componentes/feedback/MensagemErro'
import { ItemLinha } from '../componentes/totem/ItemLinha'
import { TecladoVirtual } from '../componentes/totem/TecladoVirtual'
import { useDebounce } from '../hooks/useDebounce'
import {
  obterTotem,
  listarLinhas,
  obterPrevisoes,
  formatarPrevisao,
} from '../servicos/api'
import './TelaInicio.css'

/**
 * Tela Inicial do Totem (US01 / ISS-15).
 * Alinhada fielmente ao protótipo visual do Figma.
 *
 * @param {object} props
 * @param {(linha: object) => void} props.aoSelecionarLinha - Disparado ao selecionar uma linha.
 * @param {() => void} [props.aoAbrirMapa] - Ação para abrir mapa dos arredores.
 * @param {boolean} [props.retrato=false] - Totem em pé: mostra mais linhas de início.
 */
export function TelaInicio({
  aoSelecionarLinha,
  aoAbrirMapa,
  retrato = false,
  intervaloPollingMs = 30000,
}) {
  const [totem, setTotem] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [previsoesPorLinha, setPrevisoesPorLinha] = useState({})
  const [termoBusca, setTermoBusca] = useState('')
  const [tecladoAberto, setTecladoAberto] = useState(false)
  const termoDebounced = useDebounce(termoBusca, 300)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ouvindoVoz, setOuvindoVoz] = useState(false)
  const [mensagemVoz, setMensagemVoz] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)
  const [horarioAtualizacao, setHorarioAtualizacao] = useState('')
  const limiteLinhas = retrato ? 6 : 5

  const carregarPrevisoes = async (listaLinhas) => {
    if (
      !listaLinhas ||
      listaLinhas.length === 0 ||
      typeof obterPrevisoes !== 'function'
    ) {
      return { mapa: {}, horarioRef: null }
    }
    const mapa = {}
    let horarioRef = null
    await Promise.all(
      listaLinhas.map(async (l) => {
        const idLinha = l.codigo || l.numero
        if (!l.codigo) {
          mapa[idLinha] = {
            minutos: Infinity,
            tempo: 'Sem previsão',
            status: 'Sem previsão',
            ehDestaque: false,
          }
          return
        }
        try {
          const dados = await obterPrevisoes(l.codigo)
          if (dados?.horario_referencia && !horarioRef) {
            horarioRef = dados.horario_referencia
          }
          const primeira = dados?.previsoes?.[0]
          if (primeira?.horario_previsto) {
            mapa[idLinha] = formatarPrevisao(
              primeira.horario_previsto,
              dados.horario_referencia
            )
          } else {
            mapa[idLinha] = {
              minutos: Infinity,
              tempo: 'Sem previsão',
              status: 'Sem previsão',
              ehDestaque: false,
            }
          }
        } catch {
          mapa[idLinha] = {
            minutos: Infinity,
            tempo: 'Sem previsão',
            status: 'Sem previsão',
            ehDestaque: false,
          }
        }
      })
    )
    return { mapa, horarioRef }
  }

  const carregarDados = async (termo = '') => {
    setCarregando(true)
    setErro(null)
    try {
      const [dadosTotem, dadosLinhas] = await Promise.all([
        obterTotem(),
        listarLinhas(termo),
      ])
      const { mapa: mapaPrevisoes, horarioRef } =
        await carregarPrevisoes(dadosLinhas)
      setTotem(dadosTotem)
      setPrevisoesPorLinha(mapaPrevisoes)
      if (horarioRef) {
        setHorarioAtualizacao(horarioRef)
      } else {
        setHorarioAtualizacao(
          new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        )
      }

      const linhasOrdenadas = [...(dadosLinhas || [])].sort((a, b) => {
        const idA = a.codigo || a.numero
        const idB = b.codigo || b.numero
        const minA = mapaPrevisoes[idA]?.minutos ?? Infinity
        const minB = mapaPrevisoes[idB]?.minutos ?? Infinity
        if (minA !== minB) return minA - minB
        return (a.numero || '').localeCompare(b.numero || '')
      })
      setLinhas(linhasOrdenadas)
    } catch (err) {
      setErro(err.mensagem || 'Falha ao carregar as linhas da parada.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    let ativo = true

    async function buscar(mostrarLoading = false) {
      if (mostrarLoading) {
        setCarregando(true)
        setErro(null)
      }
      try {
        const [dadosTotem, dadosLinhas] = await Promise.all([
          obterTotem(),
          listarLinhas(termoDebounced),
        ])
        const { mapa: mapaPrevisoes, horarioRef } =
          await carregarPrevisoes(dadosLinhas)
        if (ativo) {
          setTotem(dadosTotem)
          setPrevisoesPorLinha(mapaPrevisoes)
          if (horarioRef) {
            setHorarioAtualizacao(horarioRef)
          } else {
            setHorarioAtualizacao(
              new Date().toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            )
          }

          const linhasOrdenadas = [...(dadosLinhas || [])].sort((a, b) => {
            const idA = a.codigo || a.numero
            const idB = b.codigo || b.numero
            const minA = mapaPrevisoes[idA]?.minutos ?? Infinity
            const minB = mapaPrevisoes[idB]?.minutos ?? Infinity
            if (minA !== minB) return minA - minB
            return (a.numero || '').localeCompare(b.numero || '')
          })
          setLinhas(linhasOrdenadas)
        }
      } catch (err) {
        if (ativo && mostrarLoading) {
          setErro(err.mensagem || 'Falha ao carregar as linhas da parada.')
        }
      } finally {
        if (ativo && mostrarLoading) {
          setCarregando(false)
        }
      }
    }

    buscar(true)

    let timerId = null
    if (intervaloPollingMs && intervaloPollingMs > 0) {
      timerId = setInterval(() => {
        buscar(false)
      }, intervaloPollingMs)
    }

    return () => {
      ativo = false
      if (timerId) clearInterval(timerId)
    }
  }, [termoDebounced, intervaloPollingMs])

  const iniciarBuscaVoz = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMensagemVoz(
        'Busca por voz não suportada neste dispositivo. Digite a linha no campo de busca.'
      )
      setTimeout(() => setMensagemVoz(''), 5000)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = 'pt-BR'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setOuvindoVoz(true)
        setMensagemVoz('Ouvindo... Fale o número da linha ou destino.')
      }

      recognition.onresult = (event) => {
        const transcricao = event.results[0][0].transcript
        setTermoBusca(transcricao)
        setMensagemVoz(`Buscando por: "${transcricao}"`)
        setTimeout(() => setMensagemVoz(''), 4000)
      }

      recognition.onerror = () => {
        setMensagemVoz('Não foi possível identificar a voz. Tente novamente.')
        setTimeout(() => setMensagemVoz(''), 4000)
      }

      recognition.onend = () => {
        setOuvindoVoz(false)
      }

      recognition.start()
    } catch {
      setOuvindoVoz(false)
      setMensagemVoz('Não foi possível acessar o microfone.')
      setTimeout(() => setMensagemVoz(''), 4000)
    }
  }

  return (
    <div className="viasp-tela-inicio">
      {/* 1. Área Hero Principal (Figma) */}
      <section className="viasp-tela-inicio__hero">
        <span className="viasp-tela-inicio__tag">
          TRANSPORTE PÚBLICO • SÃO PAULO
        </span>
        <TextoGrande as="h1" variante="display">
          Olá! Aonde vamos?
        </TextoGrande>
        <TextoGrande variante="corpo" cor="secundario">
          Encontre a melhor linha, veja horários em tempo real ou explore o
          mapa.
        </TextoGrande>
      </section>

      {/* 2. Barra de Busca e Botão de Ação de Voz (Figma) */}
      <section className="viasp-tela-inicio__busca-row">
        <div className="viasp-tela-inicio__busca-input-box">
          <Icone nome="busca" className="viasp-tela-inicio__busca-icone" />
          <input
            type="text"
            className="viasp-tela-inicio__busca-campo"
            placeholder="Qual linha você procura?"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            onFocus={() => setTecladoAberto(true)}
            onClick={() => setTecladoAberto(true)}
            aria-label="Buscar linha por número ou destino"
          />
          <button
            type="button"
            className={`viasp-tela-inicio__busca-btn-teclado ${
              tecladoAberto ? 'viasp-tela-inicio__busca-btn-teclado--ativo' : ''
            }`}
            onClick={() => setTecladoAberto((prev) => !prev)}
            aria-label={
              tecladoAberto
                ? 'Ocultar teclado virtual'
                : 'Abrir teclado virtual'
            }
            title={tecladoAberto ? 'Ocultar teclado' : 'Abrir teclado'}
          >
            <Icone nome="teclado" />
          </button>
        </div>

        <Botao
          variante="primario"
          tamanho="grande"
          className={`viasp-tela-inicio__btn-voz ${ouvindoVoz ? 'viasp-tela-inicio__btn-voz--ativo' : ''}`}
          onClick={iniciarBuscaVoz}
          ariaLabel="Falar destino para busca por voz"
        >
          <Icone nome="microfone" />
          <span>{ouvindoVoz ? 'Ouvindo...' : 'Falar destino'}</span>
        </Botao>
      </section>

      {/* Teclado Virtual por Toque (ISS-16.1 / US02) */}
      {tecladoAberto && (
        <div className="viasp-tela-inicio__teclado-container">
          <TecladoVirtual
            aoDigitar={(char) => setTermoBusca((prev) => prev + char)}
            aoApagar={() => setTermoBusca((prev) => prev.slice(0, -1))}
            aoLimpar={() => setTermoBusca('')}
            aoFechar={() => setTecladoAberto(false)}
          />
        </div>
      )}

      {/* Feedback de voz acessível */}
      {mensagemVoz && (
        <div className="viasp-tela-inicio__aviso-voz" role="status">
          <TextoGrande variante="pequeno" peso="bold">
            {mensagemVoz}
          </TextoGrande>
        </div>
      )}

      {/* 3. Banner "Ver Mapa" (Figma) */}
      <div
        className="viasp-tela-inicio__mapa-banner"
        onClick={aoAbrirMapa}
        role={aoAbrirMapa ? 'button' : undefined}
        tabIndex={aoAbrirMapa ? 0 : undefined}
        aria-label="Ver mapa dos arredores do ponto e localização"
        onKeyDown={(e) => {
          if (aoAbrirMapa && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            aoAbrirMapa()
          }
        }}
      >
        <div className="viasp-tela-inicio__mapa-banner-icone">
          <Icone nome="mapa" tamanho="1.5rem" />
        </div>
        <div className="viasp-tela-inicio__mapa-banner-texto">
          <strong>Ver mapa</strong>
          <span>Explore a região</span>
        </div>
        <Icone nome="avancar" className="viasp-tela-inicio__mapa-banner-seta" />
      </div>

      {/* Estado de Erro da API */}
      {erro && (
        <MensagemErro
          mensagem={erro}
          aoTentarNovamente={() => carregarDados(termoBusca)}
        />
      )}

      {/* 4. Cartão Principal: VOCÊ ESTÁ EM com Tabela de Chegadas Integrada (Figma) */}
      <Cartao className="viasp-tela-inicio__ponto-card">
        <div className="viasp-tela-inicio__ponto-header">
          <div>
            <div className="viasp-tela-inicio__ponto-tag">
              <span className="viasp-tela-inicio__ponto-dot" />
              <span>VOCÊ ESTÁ EM</span>
            </div>
            <TextoGrande as="h2" variante="titulo">
              {totem?.parada?.nome || 'Av. Paulista, 1578'}
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              {totem?.parada?.endereco || 'Parada MASP — Sentido Consolação'}
            </TextoGrande>
          </div>

          <div className="viasp-tela-inicio__ponto-status">
            <span className="viasp-tela-inicio__ponto-status-dot" />
            <span>Atualizado em : {horarioAtualizacao || '--:--'}</span>
          </div>
        </div>

        {/* Tabela de Linhas e Chegadas */}
        <div className="viasp-tela-inicio__tabela-topo">
          <span>LINHAS POR CHEGADA</span>
          <span>TEMPO ESTIMADO</span>
        </div>

        {carregando ? (
          <div className="viasp-tela-inicio__carregando" role="status">
            <div className="viasp-tela-inicio__spinner" aria-hidden="true" />
            <TextoGrande variante="destaque">
              Carregando linhas do ponto...
            </TextoGrande>
          </div>
        ) : linhas.length === 0 ? (
          <div className="viasp-tela-inicio__vazio">
            <TextoGrande variante="destaque" peso="bold">
              {termoBusca
                ? 'Nenhuma linha encontrada'
                : 'Nenhum ônibus a caminho deste ponto agora'}
            </TextoGrande>
            <TextoGrande variante="corpo" cor="secundario">
              {termoBusca
                ? 'Tente outro número de linha ou limpe o campo de busca acima.'
                : 'As linhas aparecem aqui assim que houver um ônibus previsto. Tente de novo em alguns minutos.'}
            </TextoGrande>
            {termoBusca && (
              <div style={{ marginTop: '16px' }}>
                <Botao variante="secundario" onClick={() => setTermoBusca('')}>
                  Limpar busca
                </Botao>
              </div>
            )}
          </div>
        ) : (
          <div className="viasp-tela-inicio__linhas-lista" role="list">
            {(mostrarTodas ? linhas : linhas.slice(0, limiteLinhas)).map(
              (linha, idx) => (
                <ItemLinha
                  key={linha.codigo || linha.numero}
                  linha={linha}
                  index={idx}
                  previsao={previsoesPorLinha[linha.codigo || linha.numero]}
                  aoSelecionar={(linhaSelecionada) => {
                    setTecladoAberto(false)
                    aoSelecionarLinha(linhaSelecionada)
                  }}
                />
              )
            )}
          </div>
        )}

        {linhas.length > limiteLinhas && !mostrarTodas && (
          <button
            type="button"
            className="viasp-tela-inicio__ver-todas"
            onClick={() => setMostrarTodas(true)}
          >
            Ver todas as {linhas.length} linhas deste ponto →
          </button>
        )}
      </Cartao>
    </div>
  )
}
