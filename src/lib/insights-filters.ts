/** Valor sentinela para Select (Base UI mostra o value se SelectValue não tiver children). */
export const INSIGHTS_FILTRO_TODOS = 'todos'

export function insightsSelectValue(current: string): string {
  return current.trim() ? current : INSIGHTS_FILTRO_TODOS
}

export function insightsSelectOnChange(
  value: string | null | undefined,
  set: (next: string) => void
) {
  set(!value || value === INSIGHTS_FILTRO_TODOS ? '' : value)
}
