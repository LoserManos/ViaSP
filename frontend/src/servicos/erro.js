/**
 * Formato padrão e centralizado de erros da aplicação (ISS-13.2 / US08).
 */

export class ErroViaSP extends Error {
  /**
   * @param {object} params
   * @param {string} params.codigo - Código identificador da falha (ex: SPTRANS_INDISPONIVEL).
   * @param {string} params.mensagem - Mensagem amigável sem jargões técnicos.
   * @param {boolean} [params.tentar_novamente=true] - Se a interface deve permitir refazer a ação.
   * @param {number} [params.statusHttp=0] - Status HTTP correspondente, se houver.
   */
  constructor({ codigo, mensagem, tentar_novamente = true, statusHttp = 0 }) {
    super(mensagem)
    this.name = 'ErroViaSP'
    this.codigo = codigo
    this.mensagem = mensagem
    this.tentar_novamente = tentar_novamente
    this.statusHttp = statusHttp
  }
}

/**
 * Normaliza qualquer erro (HTTP, de rede ou interno) para o formato padrão do ViaSP.
 *
 * @param {unknown} erro - O erro capturado em bloco try/catch ou resposta da API.
 * @returns {ErroViaSP}
 */
export function normalizarErro(erro) {
  if (erro instanceof ErroViaSP) {
    return erro
  }

  // Falha de rede (servidor fora do ar / offline)
  if (
    erro instanceof TypeError &&
    erro.message.toLowerCase().includes('fetch')
  ) {
    return new ErroViaSP({
      codigo: 'FALHA_CONEXAO',
      mensagem:
        'Não foi possível se comunicar com o servidor do totem. Tente novamente.',
      tentar_novamente: true,
      statusHttp: 0,
    })
  }

  // Erro com payload estruturado da API
  if (erro && typeof erro === 'object') {
    const payload = /** @type {Record<string, any>} */ (erro)

    if (payload.codigo && payload.mensagem) {
      return new ErroViaSP({
        codigo: String(payload.codigo),
        mensagem: String(payload.mensagem),
        tentar_novamente: payload.tentar_novamente ?? true,
        statusHttp: payload.statusHttp || 0,
      })
    }

    // Padrão FastAPI com campo `detalhe`
    if (payload.detalhe) {
      return new ErroViaSP({
        codigo: payload.status === 503 ? 'SPTRANS_INDISPONIVEL' : 'ERRO_API',
        mensagem: String(payload.detalhe),
        tentar_novamente: payload.status !== 404,
        statusHttp: payload.status || 0,
      })
    }
  }

  // Fallback genérico seguro
  return new ErroViaSP({
    codigo: 'ERRO_DESCONHECIDO',
    mensagem:
      'Ocorreu um erro inesperado ao carregar as informações. Tente novamente.',
    tentar_novamente: true,
    statusHttp: 500,
  })
}
