/**
 * Score v1 — relevância por consolidação regional (Receita).
 * Sem ticket CNAE nem palpite de faturamento.
 *
 * versao_modelo: consolidacao_v1
 *
 * Critérios principais: rede (filiais na mesma raiz CNPJ) + maturidade (tempo de abertura).
 * potencial_estimado_mensal guarda índice 0–100 (não é R$).
 */

export const VERSAO_MODELO_V1 = 'consolidacao_v1'

/** Peso relativo dos critérios de consolidação. */
const PESO_REDE = 0.55
const PESO_IDADE = 0.45

function mesesDesdeAbertura(dataAbertura) {
  if (!dataAbertura) return null
  const d = new Date(`${dataAbertura}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

/** Maturidade operacional — tempo de abertura como sinal de estabilidade na praça. */
export function fatorIdade(dataAbertura) {
  const meses = mesesDesdeAbertura(dataAbertura)
  if (meses == null) return 0.9
  if (meses < 12) return 0.75
  if (meses < 36) return 0.9
  if (meses < 120) return 1.0
  return 1.05
}

/** Rede de lojas do mesmo titular — raiz CNPJ (8 dígitos). */
export function fatorRede(qtdEstabelecimentosRaiz) {
  const n = Number(qtdEstabelecimentosRaiz) || 1
  if (n <= 1) return 1.0
  if (n <= 3) return 1.15
  if (n <= 5) return 1.3
  return 1.4
}

/** Normaliza fator multiplicativo para escala 0–1 (espalha no ranking). */
function normalizaRede(qtdEstabelecimentosRaiz) {
  const f = fatorRede(qtdEstabelecimentosRaiz)
  if (f <= 1.0) return 0.25
  if (f <= 1.15) return 0.55
  if (f <= 1.3) return 0.8
  return 1.0
}

function normalizaIdade(dataAbertura) {
  const f = fatorIdade(dataAbertura)
  if (f <= 0.75) return 0.2
  if (f <= 0.9) return 0.5
  if (f <= 1.0) return 0.75
  return 1.0
}

/**
 * Calcula score e índice de relevância para um PDV.
 * @param {object} row — linha de alwayson_pdv_universo + qtd_estabelecimentos_raiz
 */
export function calcularScoreV1(row) {
  const redeNorm = normalizaRede(row.qtd_estabelecimentos_raiz)
  const idadeNorm = normalizaIdade(row.data_abertura)
  const scoreBruto = PESO_REDE * redeNorm + PESO_IDADE * idadeNorm
  const indiceRelevancia = Math.round(scoreBruto * 100)

  const features = {
    cnae_principal: row.cnae_principal ?? null,
    meses_abertura: mesesDesdeAbertura(row.data_abertura),
    fator_idade: fatorIdade(row.data_abertura),
    qtd_estabelecimentos_raiz: row.qtd_estabelecimentos_raiz ?? 1,
    fator_rede: fatorRede(row.qtd_estabelecimentos_raiz),
    rede_normalizada: Number(redeNorm.toFixed(4)),
    idade_normalizada: Number(idadeNorm.toFixed(4)),
    peso_rede: PESO_REDE,
    peso_idade: PESO_IDADE,
    score_bruto: Number(scoreBruto.toFixed(4)),
    indice_relevancia: indiceRelevancia,
  }

  return {
    score_potencial: Number(scoreBruto.toFixed(4)),
    potencial_estimado_mensal: indiceRelevancia,
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
