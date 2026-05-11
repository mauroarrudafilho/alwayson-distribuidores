/** Coerces Recharts Tooltip `value` (often unknown/undefined in strict typings). */
export function coerceTooltipNumber(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
