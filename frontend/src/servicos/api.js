import {
  mockTotem,
  mockLinhas,
  mockParadasPorLinha,
  mockPrevisoes,
} from '../mocks/dadosMock'
import { ErroViaSP, normalizarErro } from './erro'

const BASE_URL = import.meta.env?.VITE_API_URL || '/api'
let usarMocksForcado = import.meta.env?.VITE_USAR_MOCKS === 'true'

/**
 * Define explicitamente se o cliente deve utilizar mocks ou o backend real.
 * @param {boolean} usarMocks
 */
export function definirModoMock(usarMocks) {
  usarMocksForcado = Boolean(usarMocks)
}

/**
 * Retorna se o cliente está atualmente em modo mock.
 * @returns {boolean}
 */
export function estaUsandoMocks() {
  return usarMocksForcado
}

/**
 * Helper interno para executar requisições HTTP com fallback para mock quando offline.
 *
 * @template T
 * @param {string} endpoint - Caminho relativo sob /api
 * @param {() => T} obterMock - Função que devolve os dados mockados em caso de falha de conexão ou modo mock
 * @returns {Promise<T>}
 */
async function requisitar(endpoint, obterMock) {
  if (usarMocksForcado) {
    // Simula uma pequena latência realista de rede (50ms)
    await new Promise((resolve) => setTimeout(resolve, 50))
    return obterMock()
  }

  try {
    const resposta = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { Accept: 'application/json' },
    })

    if (!resposta.ok) {
      let payloadErro = null
      try {
        payloadErro = await resposta.json()
      } catch {
        // Corpo não é JSON
      }

      throw normalizarErro({
        status: resposta.status,
        ...(payloadErro || {}),
      })
    }

    return await resposta.json()
  } catch (erro) {
    const erroNormalizado = normalizarErro(erro)

    // Se o backend não estiver em execução (FALHA_CONEXAO), ativa fallback para mock
    // garantindo o critério de aceite: "telas conseguem trabalhar sem o backend"
    if (erroNormalizado.codigo === 'FALHA_CONEXAO') {
      return obterMock()
    }

    throw erroNormalizado
  }
}

/**
 * Obtém os dados de identificação do totem e da parada onde está instalado.
 * @returns {Promise<typeof mockTotem>}
 */
export async function obterTotem() {
  return requisitar('/totem', () => mockTotem)
}

/**
 * Lista as linhas que atendem a parada, com suporte a filtro opcional por termo.
 *
 * @param {string} [termo=''] - Número ou nome da linha para filtragem.
 * @returns {Promise<Array<typeof mockLinhas[0]>>}
 */
export async function listarLinhas(termo = '') {
  const query = termo.trim() ? `?termo=${encodeURIComponent(termo.trim())}` : ''

  return requisitar(`/linhas${query}`, () => {
    if (!termo.trim()) return mockLinhas
    const busca = termo.toLowerCase().trim()
    return mockLinhas.filter(
      (l) =>
        l.numero.toLowerCase().includes(busca) ||
        l.destino.toLowerCase().includes(busca) ||
        l.origem.toLowerCase().includes(busca)
    )
  })
}

/**
 * Consulta a lista ordenada de paradas principais atendidas por uma linha (US03).
 *
 * @param {number} codigoLinha
 * @returns {Promise<Array<typeof mockParadasPorLinha[1001][0]>>}
 */
export async function listarParadasDaLinha(codigoLinha) {
  return requisitar(`/linhas/${codigoLinha}/paradas`, () => {
    if (mockParadasPorLinha[codigoLinha]) {
      return mockParadasPorLinha[codigoLinha]
    }
    const linha = mockLinhas.find((l) => l.codigo === codigoLinha)
    if (linha) {
      return [
        { codigo: 9001, nome: linha.origem, access: true },
        { codigo: 9002, nome: 'Av. Central, 500', access: true },
        mockTotem.parada,
        { codigo: 9003, nome: 'Av. Principal, 1000', access: true },
        { codigo: 9004, nome: linha.destino, access: true },
      ]
    }
    return [mockTotem.parada]
  })
}

/**
 * Consulta a previsão de chegada dos próximos veículos para uma linha (US06/US07).
 *
 * @param {number} codigoLinha
 * @returns {Promise<typeof mockPrevisoes[1001]>}
 */
export async function obterPrevisoes(codigoLinha) {
  return requisitar(`/previsoes?codigo_linha=${codigoLinha}`, () => {
    const previsao = mockPrevisoes[codigoLinha]
    if (previsao) return previsao

    // Mock dinâmico para linhas que não têm fixture específica
    const linha =
      mockLinhas.find((l) => l.codigo === codigoLinha) || mockLinhas[0]
    return {
      parada: mockTotem.parada,
      linha,
      horario_consulta: new Date().toISOString(),
      horario_referencia: '19:50',
      estado: 'sucesso',
      previsoes: [
        { horario_previsto: '19:58', veiculo: { prefixo: '10999' } },
        { horario_previsto: '20:15', veiculo: { prefixo: '10888' } },
      ],
    }
  })
}

/**
 * Calcula os minutos de espera entre o horário previsto e o horário de referência ("HH:MM").
 * Trata virada de meia-noite e não retorna valores negativos.
 *
 * @param {string} horarioPrevisto - Horário no formato "HH:MM".
 * @param {string} [horarioReferencia] - Horário de referência no formato "HH:MM". Se omitido, usa a hora local.
 * @returns {number | null} Minutos de espera ou null se horário for inválido.
 */
export function calcularTempoEsperaMinutos(horarioPrevisto, horarioReferencia) {
  if (!horarioPrevisto || typeof horarioPrevisto !== 'string') return null
  const partesPrev = horarioPrevisto.split(':').map((p) => parseInt(p, 10))
  if (partesPrev.length < 2 || isNaN(partesPrev[0]) || isNaN(partesPrev[1])) return null
  const minutosPrev = partesPrev[0] * 60 + partesPrev[1]

  let minutosRef
  if (horarioReferencia && typeof horarioReferencia === 'string') {
    const partesRef = horarioReferencia.split(':').map((p) => parseInt(p, 10))
    if (partesRef.length >= 2 && !isNaN(partesRef[0]) && !isNaN(partesRef[1])) {
      minutosRef = partesRef[0] * 60 + partesRef[1]
    }
  }

  if (minutosRef === undefined) {
    const agora = new Date()
    minutosRef = agora.getHours() * 60 + agora.getMinutes()
  }

  let diferenca = minutosPrev - minutosRef
  if (diferenca < 0) {
    // Trata virada de meia-noite (ex.: 00:03 com referência 23:58 -> +5 min)
    if (diferenca < -720) {
      diferenca += 24 * 60
    } else {
      diferenca = 0
    }
  }
  return diferenca
}

/**
 * Formata os dados de previsão calculando o tempo e rótulo de status.
 *
 * @param {string} [horarioPrevisto] - Horário previsto "HH:MM".
 * @param {string} [horarioReferencia] - Horário de referência "HH:MM".
 * @returns {{ minutos: number, tempo: string, status: string, ehDestaque: boolean }}
 */
export function formatarPrevisao(horarioPrevisto, horarioReferencia) {
  const minutos = calcularTempoEsperaMinutos(horarioPrevisto, horarioReferencia)
  if (minutos === null) {
    return {
      minutos: Infinity,
      tempo: 'Sem previsão',
      status: 'Sem previsão',
      ehDestaque: false,
    }
  }
  const ehDestaque = minutos <= 3
  const status = ehDestaque ? 'Chegando' : 'No horário'
  const tempo = minutos === 0 ? 'Chegando' : `${minutos} min`
  return { minutos, tempo, status, ehDestaque }
}

/**
 * Requisição às rotas /api/dev (modo dev do backend). Sem mock nem fallback:
 * só fazem sentido com o backend rodando com `python -m app --dev`.
 *
 * @param {string} endpoint - Caminho relativo sob /api/dev
 * @param {RequestInit} [opcoes]
 */
async function requisitarDev(endpoint, opcoes = {}) {
  let resposta
  try {
    resposta = await fetch(`${BASE_URL}/dev${endpoint}`, {
      ...opcoes,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  } catch (erro) {
    throw normalizarErro(erro)
  }

  if (resposta.status === 404 && endpoint.startsWith('/paradas')) {
    throw new ErroViaSP({
      codigo: 'MODO_DEV_DESLIGADO',
      mensagem:
        'Suba o backend com "python -m app --dev" para escolher a parada.',
      tentar_novamente: false,
      statusHttp: 404,
    })
  }
  if (!resposta.ok) {
    let payloadErro = null
    try {
      payloadErro = await resposta.json()
    } catch {
      // Corpo não é JSON
    }
    throw normalizarErro({ status: resposta.status, ...(payloadErro || {}) })
  }
  return resposta.json()
}

/**
 * Paradas do GTFS dentro de uma área do mapa (modo dev).
 *
 * @param {{latMin: number, latMax: number, lonMin: number, lonMax: number}} area
 * @param {number} [limite=500]
 * @returns {Promise<{paradas: Array<typeof mockTotem.parada>, truncado: boolean}>}
 */
export async function listarParadasNaArea(
  { latMin, latMax, lonMin, lonMax },
  limite = 500
) {
  const query = new URLSearchParams({
    lat_min: latMin,
    lat_max: latMax,
    lon_min: lonMin,
    lon_max: lonMax,
    limite,
  })
  return requisitarDev(`/paradas?${query}`)
}

/**
 * Troca a parada do totem (modo dev). Vale até o backend reiniciar.
 *
 * @param {number} codigo - Código da parada no GTFS / SPTrans.
 * @returns {Promise<typeof mockTotem>}
 */
export async function escolherParada(codigo) {
  return requisitarDev('/parada', {
    method: 'PUT',
    body: JSON.stringify({ codigo }),
  })
}
