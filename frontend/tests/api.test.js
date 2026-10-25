import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  obterTotem,
  listarLinhas,
  listarParadasDaLinha,
  obterPrevisoes,
  definirModoMock,
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
