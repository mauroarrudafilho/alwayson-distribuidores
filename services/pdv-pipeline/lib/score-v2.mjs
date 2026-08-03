/**
 * Score v2 — relevância por dados declarados na Receita + consolidação.
 *
 * versao_modelo: consolidacao_v2
 *
 * Sem palpite de ticket por CNAE. Usa:
 *   • capital_social declarado (percentil na cidade, escala log)
 *   • porte Receita (01 micro · 03 EPP · 05 demais)
 *   • rede (filiais mesma raiz CNPJ)
 *   • maturidade (abertura)
 *   • diversidade CNAE (qtd secundários declarados — sinal fraco)
 *
 * potencial_estimado_mensal = índice 0–100 (percentis compostos na praça).
 */

export const VERSAO_MODELO_V2 = 'consolidacao_v2'

const PESOS = {
  capital: 0.35,
  rede: 0.25,
  idade: 0.2,
  porte: 0.15,
  cnae: 0.05,
}

/** Porte na Receita Federal (coluna porte da tabela Empresas). */
const PORTE_ORDEM = { '05': 4, '03': 3, '01': 2, '00': 1 }

function mesesDesdeAbertura(dataAbertura) {
  if (!dataAbertura) return null
  const d = new Date(`${dataAbertura}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

export function mesesAbertura(dataAbertura) {
  return mesesDesdeAbertura(dataAbertura)
}

export function valorRede(qtdEstabelecimentosRaiz) {
  const n = Number(qtdEstabelecimentosRaiz) || 1
  if (n <= 1) return 1
  if (n <= 3) return 2
  if (n <= 5) return 3
  return 4
}

export function valorIdade(dataAbertura) {
  const meses = mesesDesdeAbertura(dataAbertura)
  if (meses == null) return 1
  if (meses < 12) return 1
  if (meses < 36) return 2
  if (meses < 120) return 3
  return 4
}

export function valorPorte(porte) {
  return PORTE_ORDEM[String(porte ?? '').padStart(2, '0')] ?? 1
}

export function valorCapitalLog(capitalSocial) {
  const v = Math.max(Number(capitalSocial) || 0, 1)
  return Math.log10(v)
}

export function valorCnaeSecundarios(cnaeSecundarios) {
  const n = Array.isArray(cnaeSecundarios) ? cnaeSecundarios.length : 0
  return Math.min(n, 12)
}

/** Percentil 0–1 (empates recebem média dos ranks). */
export function percentilRank(valores, index) {
  const v = valores[index]
  let abaixo = 0
  let iguais = 0
  for (const x of valores) {
    if (x < v) abaixo++
    else if (x === v) iguais++
  }
  if (iguais <= 1) return abaixo / Math.max(1, valores.length - 1)
  const rankMedio = abaixo + (iguais - 1) / 2
  return rankMedio / Math.max(1, valores.length - 1)
}

/**
 * Calcula scores para um lote (idealmente uma cidade) com normalização por percentil.
 * @param {Array<object>} rows
 */
export function calcularScoresV2(rows) {
  if (!rows.length) return []

  const capitalLog = rows.map((r) => valorCapitalLog(r.capital_social))
  const rede = rows.map((r) => valorRede(r.qtd_estabelecimentos_raiz))
  const idade = rows.map((r) => valorIdade(r.data_abertura))
  const porte = rows.map((r) => valorPorte(r.porte))
  const cnae = rows.map((r) => valorCnaeSecundarios(r.cnae_secundarios))

  return rows.map((row, i) => {
    const pctCapital = percentilRank(capitalLog, i)
    const pctRede = percentilRank(rede, i)
    const pctIdade = percentilRank(idade, i)
    const pctPorte = percentilRank(porte, i)
    const pctCnae = percentilRank(cnae, i)

    const scoreBruto =
      PESOS.capital * pctCapital +
      PESOS.rede * pctRede +
      PESOS.idade * pctIdade +
      PESOS.porte * pctPorte +
      PESOS.cnae * pctCnae

    const indice = Math.round(scoreBruto * 100)

    const features = {
      cnae_principal: row.cnae_principal ?? null,
      capital_social: row.capital_social ?? null,
      porte: row.porte ?? null,
      meses_abertura: mesesDesdeAbertura(row.data_abertura),
      qtd_estabelecimentos_raiz: row.qtd_estabelecimentos_raiz ?? 1,
      qtd_cnae_secundarios: Array.isArray(row.cnae_secundarios)
        ? row.cnae_secundarios.length
        : 0,
      pct_capital: Number(pctCapital.toFixed(4)),
      pct_rede: Number(pctRede.toFixed(4)),
      pct_idade: Number(pctIdade.toFixed(4)),
      pct_porte: Number(pctPorte.toFixed(4)),
      pct_cnae: Number(pctCnae.toFixed(4)),
      pesos: PESOS,
      score_bruto: Number(scoreBruto.toFixed(4)),
      indice_relevancia: indice,
    }

    return {
      cnpj: row.cnpj,
      score_potencial: Number(scoreBruto.toFixed(4)),
      potencial_estimado_mensal: indice,
      features,
    }
  })
}

/** Atribui faixas A–D por quartis do score dentro do recorte. */
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

export function labelPorteReceita(porte) {
  const p = String(porte ?? '').padStart(2, '0')
  if (p === '05') return 'Demais portes'
  if (p === '03') return 'EPP'
  if (p === '01') return 'Microempresa'
  if (p === '00') return 'Não informado'
  return porte ? `Porte ${porte}` : '—'
}
