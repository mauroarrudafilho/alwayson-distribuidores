/**
 * Rótulos para selects de tenant/entidade — nunca exibir UUID bruto na UI.
 */
export function labelFromOptions(
  id: string | undefined,
  options: ReadonlyArray<{ id: string; nome: string }>,
  fallback = 'Selecione'
): string {
  if (!id) return fallback
  return options.find((o) => o.id === id)?.nome ?? fallback
}

/** Detecta UUID v4 — não usar como texto visível ao utilizador. */
export function looksLikeUuid(value: string | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}
