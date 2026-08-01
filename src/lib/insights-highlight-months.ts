/** Mês de referência da vigência de análise (início do período, ex. mai/26 na janela mai–ago). */
export function mesReferenciaAnalise(periodoAnalise: { inicio?: string; fim?: string } | undefined) {
  return periodoAnalise?.inicio ?? periodoAnalise?.fim
}

/**
 * Meses em destaque na evolução histórica: o mês vigente da análise (início do período)
 * e o mesmo mês calendário nos anos anteriores presentes no histórico (comparativo YoY).
 */
export function computeHighlightMonths(
  periodoAnalise: { inicio?: string; fim?: string } | undefined,
  historicoMonths: string[]
): Set<string> {
  const highlights = new Set<string>()
  if (historicoMonths.length === 0) return highlights

  const ref = mesReferenciaAnalise(periodoAnalise)
  if (!ref) {
    highlights.add(historicoMonths[historicoMonths.length - 1])
    return highlights
  }

  const [, refMonth] = ref.split('-')
  if (!refMonth) return highlights

  if (historicoMonths.includes(ref)) {
    highlights.add(ref)
  }

  for (const m of historicoMonths) {
    const [, mm] = m.split('-')
    if (mm === refMonth) {
      highlights.add(m)
    }
  }

  return highlights
}

export function mesAnaliseNoHistorico(
  periodoAnalise: { inicio?: string; fim?: string } | undefined,
  historico: { ano_mes: string; faturamento: number; total_nfs: number; total_skus: number; quantidade_total: number }[]
) {
  const ref = mesReferenciaAnalise(periodoAnalise)
  if (!ref) return historico[historico.length - 1] ?? null

  const exact = historico.find((h) => h.ano_mes === ref)
  if (exact) return exact

  const [, refMonth] = ref.split('-')
  if (!refMonth) return null

  const sameCalendar = historico.filter((h) => h.ano_mes.split('-')[1] === refMonth)
  if (sameCalendar.length === 0) return null

  return sameCalendar.reduce((best, h) => (h.ano_mes > best.ano_mes ? h : best))
}

export function mesYoYAnterior(
  anoMes: string,
  historico: { ano_mes: string; faturamento: number }[]
) {
  const [y, m] = anoMes.split('-')
  const prev = `${Number(y) - 1}-${m}`
  return historico.find((h) => h.ano_mes === prev) ?? null
}
