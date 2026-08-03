/**
 * Score v0 — heurístico, só atributos Receita + geocode CNEFE.
 * Sem sell-in, sell-out ou Insights.
 *
 * versao_modelo: receita_cnefe_v0
 */

export const VERSAO_MODELO_V0 = 'receita_cnefe_v0'

/** Ticket mensal de referência (R$) por CNAE — ordens de magnitude para ranking, não forecast calibrado. */
const TICKET_MENSAL_CNAE = {
  4711301: 45_000, // super/hiper
  4635402: 35_000, // atacado bebidas
  4723700: 12_000, // varejo bebidas
  5611204: 8_000, // bar
  5611205: 8_000,
  5611201: 6_000, // restaurante
  4711302: 5_000, // minimercado
}

const CNAE_PESO = {
  4711301: 1.2,
  4635402: 1.1,
  4723700: 1.0,
  5611204: 0.95,
  5611205: 0.95,
  5611201: 0.85,
  4711302: 0.9,
}

/** Confiança do endereço (CNEFE) — entra como fator multiplicativo leve. */
const FATOR_GEO = {
  numero_exato: 1.0,
  logradouro: 0.97,
  cep: 0.92,
  setor_censitario: 0.88,
  nulo: 0.85,
}

function mesesDesdeAbertura(dataAbertura) {
  if (!dataAbertura) return null
  const d = new Date(`${dataAbertura}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

/** Maturidade operacional — tempo de abertura como sinal de estabilidade. */
export function fatorIdade(dataAbertura) {
  const meses = mesesDesdeAbertura(dataAbertura)
  if (meses == null) return 0.9
  if (meses < 12) return 0.75
  if (meses < 36) return 0.9
  if (meses < 120) return 1.0
  return 1.05
}

/** Rede de lojas do mesmo titular — conta estabelecimentos com a mesma raiz de CNPJ (8 dígitos). */
export function fatorRede(qtdEstabelecimentosRaiz) {
  const n = Number(qtdEstabelecimentosRaiz) || 1
  if (n <= 1) return 1.0
  if (n <= 3) return 1.15
  if (n <= 5) return 1.3
  return 1.4
}

export function fatorGeo(nivelGeocodificacao) {
  return FATOR_GEO[nivelGeocodificacao] ?? FATOR_GEO.nulo
}

export function pesoCnae(cnae) {
  return CNAE_PESO[cnae] ?? 0.8
}

export function ticketBaseCnae(cnae) {
  return TICKET_MENSAL_CNAE[cnae] ?? 5_000
}

/**
 * Calcula score e potencial para um PDV.
 * @param {object} row — linha de alwayson_pdv_universo + qtd_estabelecimentos_raiz
 */
export function calcularScoreV0(row) {
  const cnae = row.cnae_principal
  const idade = fatorIdade(row.data_abertura)
  const rede = fatorRede(row.qtd_estabelecimentos_raiz)
  const geo = fatorGeo(row.nivel_geocodificacao)
  const peso = pesoCnae(cnae)

  const scoreBruto = peso * idade * rede * geo
  const potencial = Math.round(ticketBaseCnae(cnae) * idade * rede * geo)

  const features = {
    cnae_principal: cnae,
    meses_abertura: mesesDesdeAbertura(row.data_abertura),
    fator_idade: idade,
    qtd_estabelecimentos_raiz: row.qtd_estabelecimentos_raiz ?? 1,
    fator_rede: rede,
    nivel_geocodificacao: row.nivel_geocodificacao ?? 'nulo',
    fator_geo: geo,
    peso_cnae: peso,
    score_bruto: Number(scoreBruto.toFixed(4)),
  }

  return {
    score_potencial: Number(scoreBruto.toFixed(4)),
    potencial_estimado_mensal: potencial,
    features,
  }
}

/** Atribui faixas A–D por quartis do score dentro do recorte (ex.: cidade). */
export function atribuirFaixas(resultados) {
  if (!resultados.length) return resultados

  const sorted = [...resultados].sort(
    (a, b) => b.score_potencial - a.score_potencial
  )
  const n = sorted.length
  const q = (i) => Math.min(n - 1, Math.floor((i / n) * n))

  for (let i = 0; i < n; i++) {
    const pct = i / n
    let faixa = 'D'
    if (pct < 0.25) faixa = 'A'
    else if (pct < 0.5) faixa = 'B'
    else if (pct < 0.75) faixa = 'C'
    sorted[i].faixa = faixa
  }

  const byCnpj = new Map(sorted.map((r) => [r.cnpj, r.faixa]))
  return resultados.map((r) => ({ ...r, faixa: byCnpj.get(r.cnpj) ?? 'D' }))
}
