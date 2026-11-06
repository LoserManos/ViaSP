import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  obterTotem,
  listarLinhas,
  listarParadasDaLinha,
  obterPrevisoes,
  definirModoMock,
  calcularTempoEsperaMinutos,
  formatarPrevisao,
} from '../src/servicos/api'
import { ErroViaSP, normalizarErro } from '../src/servicos/erro'

describe('Serviço de API e Mocks (ISS-14.3)', () => {
  beforeEach(() => {
    definirModoMock(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('obterTotem retorna dados da parada configurada no totem', async () => {
    const totem = await obterTotem()
    expect(totem).toHaveProperty('identificador')
    expect(totem.parada).toHaveProperty('codigo')
    expect(totem.parada.nome).toContain('MASP')
  })

  it('listarLinhas devolve todas as linhas disponíveis no ponto', async () => {
    const linhas = await listarLinhas()
    expect(Array.isArray(linhas)).toBe(true)
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas[0]).toHaveProperty('numero')
    expect(linhas[0]).toHaveProperty('sentido')
    expect(linhas[0]).toHaveProperty('destino')
  })

  it('listarLinhas filtra corretamente por número ou destino', async () => {
    const linhasFiltradas = await listarLinhas('8012')
    expect(linhasFiltradas).toHaveLength(1)
    expect(linhasFiltradas[0].numero).toBe('8012-10')

    const porDestino = await listarLinhas('Santana')
    expect(porDestino).toHaveLength(1)
    expect(porDestino[0].numero).toBe('175P-10')
  })

  it('listarParadasDaLinha retorna o itinerário com paradas ordenadas', async () => {
    const paradas = await listarParadasDaLinha(1001)
    expect(Array.isArray(paradas)).toBe(true)
    expect(paradas.length).toBeGreaterThanOrEqual(2)
    expect(paradas[0]).toHaveProperty('nome')
    expect(paradas[0]).toHaveProperty('latitude')
    expect(paradas[0]).toHaveProperty('longitude')
  })

  it('obterPrevisoes retorna a lista de ônibus a caminho com horário', async () => {
    const consulta = await obterPrevisoes(1001)
    expect(consulta).toHaveProperty('parada')
    expect(consulta).toHaveProperty('linha')
    expect(consulta.estado).toBe('sucesso')
    expect(Array.isArray(consulta.previsoes)).toBe(true)
    expect(consulta.previsoes[0]).toHaveProperty('horario_previsto')
    expect(consulta.previsoes[0].veiculo).toHaveProperty('prefixo')
  })
})

describe('Tratamento de Erros Padronizado (US08 / ISS-13.2)', () => {
  it('normaliza erro de conexão para o padrão ErroViaSP', () => {
    const erroRede = new TypeError('Failed to fetch')
    const normalizado = normalizarErro(erroRede)

    expect(normalizado).toBeInstanceOf(ErroViaSP)
    expect(normalizado.codigo).toBe('FALHA_CONEXAO')
    expect(normalizado.tentar_novamente).toBe(true)
    expect(normalizado.mensagem).toContain('servidor do totem')
  })

  it('preserva payload de erro já estruturado da API', () => {
    const erroApi = {
      codigo: 'SPTRANS_INDISPONIVEL',
      mensagem: 'A SPTrans está indisponível no momento.',
      tentar_novamente: true,
      statusHttp: 503,
    }

    const normalizado = normalizarErro(erroApi)
    expect(normalizado.codigo).toBe('SPTRANS_INDISPONIVEL')
    expect(normalizado.mensagem).toBe('A SPTrans está indisponível no momento.')
    expect(normalizado.tentar_novamente).toBe(true)
  })
})

describe('Cálculo Dinâmico de Previsão de Chegada (US01 / US06)', () => {
  it('calcula a diferença de tempo corretamente em minutos', () => {
    expect(calcularTempoEsperaMinutos('19:48', '19:45')).toBe(3)
    expect(calcularTempoEsperaMinutos('19:45', '19:45')).toBe(0)
    expect(calcularTempoEsperaMinutos('20:10', '19:45')).toBe(25)
  })

  it('trata virada de meia-noite', () => {
    expect(calcularTempoEsperaMinutos('00:03', '23:58')).toBe(5)
  })

  it('retorna 0 para previsões no passado imediato', () => {
    expect(calcularTempoEsperaMinutos('14:05', '14:10')).toBe(0)
  })

  it('formata status e rótulo de tempo dinamicamente', () => {
    const p1 = formatarPrevisao('19:48', '19:45')
    expect(p1.minutos).toBe(3)
    expect(p1.tempo).toBe('3 min')
    expect(p1.status).toBe('Chegando')
    expect(p1.ehDestaque).toBe(true)

    const p2 = formatarPrevisao('19:53', '19:45')
    expect(p2.minutos).toBe(8)
    expect(p2.tempo).toBe('8 min')
    expect(p2.status).toBe('No horário')
    expect(p2.ehDestaque).toBe(false)

    const pVazia = formatarPrevisao(null)
    expect(pVazia.tempo).toBe('Sem previsão')
    expect(pVazia.status).toBe('Sem previsão')
  })
})
