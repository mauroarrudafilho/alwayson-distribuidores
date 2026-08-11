/**
 * Janela temporal da Performance e o período contra o qual ela é comparada.
 *
 * A janela termina no último mês **completo**, nunca no mês em curso: em 11/08
 * agosto tem 48 NFs contra ~600 de um mês fechado, e incluí-lo faria a leitura
 * parecer um colapso. O mês em curso aparece no gráfico, marcado — ver
 * `mesEmCurso`.
 */

export type JanelaMeses = 6 | 12 | 24 | 0
export type ComparacaoModo = 'ano_anterior' | 'periodo_anterior' | 'nenhum'

export interface Janela {
  /** YYYY-MM */
  inicio: string
  /** YYYY-MM */
  fim: string
  /** Todos os meses da janela, em ordem crescente. */
  meses: string[]
}

/** Primeiro mês com dado no banco. Antes disto não há o que comparar. */
export const PRIMEIRO_MES_SERIE = '2025-01'

function toKey(ano: number, mesIndex0: number): string {
  const d = new Date(Date.UTC(ano, mesIndex0, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function parseKey(key: string): { ano: number; mes0: number } {
  const [a, m] = key.split('-').map(Number)
  return { ano: a, mes0: m - 1 }
}

function somarMeses(key: string, delta: number): string {
  const { ano, mes0 } = parseKey(key)
  return toKey(ano, mes0 + delta)
}

function intervalo(inicio: string, fim: string): string[] {
  const out: string[] = []
  let cursor = inicio
  while (cursor <= fim) {
    out.push(cursor)
    cursor = somarMeses(cursor, 1)
  }
  return out
}

/** Mês corrente, que está incompleto por definição. */
export function mesEmCurso(hoje: Date = new Date()): string {
  return toKey(hoje.getFullYear(), hoje.getMonth())
}

export function calcularJanela(janela: JanelaMeses, hoje: Date = new Date()): Janela {
  const fim = somarMeses(mesEmCurso(hoje), -1)
  const inicio =
    janela === 0 ? PRIMEIRO_MES_SERIE : somarMeses(fim, -(janela - 1))
  const inicioLimitado = inicio < PRIMEIRO_MES_SERIE ? PRIMEIRO_MES_SERIE : inicio
  return { inicio: inicioLimitado, fim, meses: intervalo(inicioLimitado, fim) }
}

/**
 * Devolve null quando não há contraparte — para jan/2025 não existe 2024 no
 * banco, e a tela mostra a variação vazia em vez de inventar um número.
 */
export function calcularComparacao(base: Janela, modo: ComparacaoModo): Janela | null {
  if (modo === 'nenhum') return null

  const deslocamento =
    modo === 'ano_anterior' ? -12 : -base.meses.length

  const inicio = somarMeses(base.inicio, deslocamento)
  const fim = somarMeses(base.fim, deslocamento)
  if (fim < PRIMEIRO_MES_SERIE) return null

  const inicioLimitado = inicio < PRIMEIRO_MES_SERIE ? PRIMEIRO_MES_SERIE : inicio
  return { inicio: inicioLimitado, fim, meses: intervalo(inicioLimitado, fim) }
}
