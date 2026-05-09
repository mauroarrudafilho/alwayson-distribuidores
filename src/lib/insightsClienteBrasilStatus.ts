import type { InsightsClienteBrasilStatus } from '@/types/insights'

export function parseInsightsClienteBrasilStatus(
  raw: unknown
): InsightsClienteBrasilStatus | undefined {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (
    s === 'pending' ||
    s === 'processing' ||
    s === 'ready' ||
    s === 'not_found' ||
    s === 'error'
  )
    return s
  return undefined
}

export function insightsClienteBrasilStatusTitle(
  s: InsightsClienteBrasilStatus | undefined
): string {
  switch (s) {
    case 'pending':
      return 'Cadastro BrasilAPI: pendente (fila)'
    case 'processing':
      return 'Cadastro BrasilAPI: processando'
    case 'ready':
      return 'Cadastro BrasilAPI: OK'
    case 'not_found':
      return 'Cadastro BrasilAPI: não encontrado / inválido'
    case 'error':
      return 'Cadastro BrasilAPI: erro na última tentativa'
    default:
      return 'Cadastro BrasilAPI'
  }
}
