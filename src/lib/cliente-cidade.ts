/** Cidade/UF ausentes ou placeholder da ingestão de vendas. */
export function isCidadeVazia(
  cidade: string | null | undefined,
  estado?: string | null | undefined
): boolean {
  const c = String(cidade ?? '').trim()
  const e = String(estado ?? '').trim()
  const vazio = (s: string) => !s || s === '—' || s === '-'
  return vazio(c) || vazio(e)
}

export function resolveClienteCidadeUf(
  local: { cidade?: string | null; estado?: string | null },
  insights?: { cidade?: string | null; estado?: string | null } | null
): { cidade: string; estado: string; fromInsights: boolean } {
  if (!isCidadeVazia(local.cidade, local.estado)) {
    return {
      cidade: String(local.cidade).trim(),
      estado: String(local.estado).trim(),
      fromInsights: false,
    }
  }
  if (insights && !isCidadeVazia(insights.cidade, insights.estado)) {
    return {
      cidade: String(insights.cidade).trim(),
      estado: String(insights.estado).trim(),
      fromInsights: true,
    }
  }
  return { cidade: local.cidade?.trim() || '—', estado: local.estado?.trim() || '—', fromInsights: false }
}
