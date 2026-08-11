/**
 * Mês de referência da vigência de análise — o FIM do período (o mês mais
 * recente, ex. ago/26 numa janela ago/25–ago/26), não o início. Antes que a
 * Performance virasse janela de vários meses `inicio === fim` e tanto fazia;
 * com janela de 12 meses, ancorar no início comparava o mix local de um mês
 * isolado (o mais antigo da janela) contra totais que somam a janela inteira.
 */
export function mesReferenciaAnalise(periodoAnalise: { inicio?: string; fim?: string } | undefined) {
  return periodoAnalise?.fim ?? periodoAnalise?.inicio
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
