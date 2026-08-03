/** Piloto Explorar — Petrolina/PE (expandir após validar o fluxo). */
export const PILOTO_PETROLINA = {
  codigo_ibge: 2611101,
  municipio: 'PETROLINA',
  uf: 'PE',
  distribuidor_id: '6b551b8c-2f3e-4b3b-94f0-c34ac59be9e4',
}

export function parseCodigosIbge(raw) {
  if (!raw?.length) return []
  const out = new Set()
  for (const part of raw) {
    for (const token of String(part).split(',')) {
      const n = Number(token.trim().replace(/\D/g, ''))
      if (Number.isFinite(n) && n > 0) out.add(n)
    }
  }
  return [...out]
}

export function codigoIbgeCol(cols) {
  if (!cols[20]) return null
  const n = Number(String(cols[20]).replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
