/**
 * Dados mockados seguindo rigorosamente o contrato da API do backend (ISS-13.1).
 * Representam o totem da Parada MASP (Av. Paulista, 1578) visto no protótipo do Figma.
 */

export const mockParadaMasp = {
  codigo: 260015038,
  nome: 'Parada MASP',
  endereco: 'Av. Paulista, 1578 — Bela Vista, São Paulo - SP',
  latitude: -23.561498,
  longitude: -46.655963,
}

export const mockTotem = {
  identificador: 'TOTEM-MASP-01',
  parada: mockParadaMasp,
}

export const mockLinhas = [
  {
    codigo: 1001,
    numero: '8012-10',
    sentido: 1,
    origem: 'Cidade Universitária',
    destino: 'Aeroporto Congonhas',
    corBadge: 'vermelha',
  },
  {
    codigo: 1002,
    numero: '875A-10',
    sentido: 1,
    origem: 'Aeroporto',
    destino: 'Perdizes',
    corBadge: 'azul',
  },
  {
    codigo: 1003,
    numero: '175P-10',
    sentido: 1,
    origem: 'Edu Chaves',
    destino: 'Metrô Santana',
    corBadge: 'verde',
  },
  {
    codigo: 1004,
    numero: '917H-10',
    sentido: 2,
    origem: 'Terminal Sacomã',
    destino: 'Terminal Pirituba',
    corBadge: 'laranja',
  },
  {
    codigo: 1005,
    numero: '775P-10',
    sentido: 1,
    origem: 'Metrô Ana Rosa',
    destino: 'Jd. Guaraní',
    corBadge: 'azul',
  },
]

export const mockParadasPorLinha = {
  1001: [
    mockParadaMasp,
    {
      codigo: 260015039,
      nome: 'Parada Trianon-Masp',
      endereco: 'Av. Paulista, 1374',
      latitude: -23.563,
      longitude: -46.653,
    },
    {
      codigo: 260015040,
      nome: 'Parada Brigadeiro',
      endereco: 'Av. Paulista, 800',
      latitude: -23.568,
      longitude: -46.648,
    },
    {
      codigo: 260015045,
      nome: 'Aeroporto de Congonhas (Desembarque)',
      endereco: 'Av. Washington Luís, s/n',
      latitude: -23.627,
      longitude: -46.656,
    },
  ],
  1002: [
    mockParadaMasp,
    {
      codigo: 260015032,
      nome: 'Parada Consolação',
      endereco: 'Av. Paulista, 2100',
      latitude: -23.557,
      longitude: -46.661,
    },
    {
      codigo: 260015033,
      nome: 'Rua da Consolação, 2400',
      endereco: 'Rua da Consolação, 2400',
      latitude: -23.553,
      longitude: -46.663,
    },
    {
      codigo: 260015034,
      nome: 'Parada PUC-SP / Perdizes',
      endereco: 'Rua Monte Alegre, 984',
      latitude: -23.538,
      longitude: -46.671,
    },
  ],
}

export const mockPrevisoes = {
  1001: {
    parada: mockParadaMasp,
    linha: mockLinhas[0],
    horario_consulta: new Date().toISOString(),
    horario_referencia: '19:45',
    estado: 'sucesso',
    previsoes: [
      { horario_previsto: '19:48', veiculo: { prefixo: '12845' } },
      { horario_previsto: '20:02', veiculo: { prefixo: '12990' } },
    ],
  },
  1002: {
    parada: mockParadaMasp,
    linha: mockLinhas[1],
    horario_consulta: new Date().toISOString(),
    horario_referencia: '19:45',
    estado: 'sucesso',
    previsoes: [
      { horario_previsto: '19:53', veiculo: { prefixo: '21004' } },
      { horario_previsto: '20:10', veiculo: { prefixo: '21055' } },
    ],
  },
  1003: {
    parada: mockParadaMasp,
    linha: mockLinhas[2],
    horario_consulta: new Date().toISOString(),
    horario_referencia: '19:45',
    estado: 'sucesso',
    previsoes: [{ horario_previsto: '19:59', veiculo: { prefixo: '33412' } }],
  },
}
