/**
 * CNAEs de interesse — spec PDV v2.
 * Na Receita aberta vêm como 7 dígitos (ex.: 4723700).
 */
export const CNAES_PDV = [
  '4723700', // 4723-7/00 varejo de bebidas
  '4711302', // 4711-3/02 minimercados, mercearias e armazéns
  '4711301', // 4711-3/01 hipermercados e supermercados
  '5611201', // 5611-2/01 restaurantes
  '5611204', // 5611-2/04 bares
  '5611205', // 5611-2/05 bares (outros)
  '4635402', // 4635-4/02 atacado de bebidas
]

export const CNAES_PDV_SET = new Set(CNAES_PDV)

/** Situação cadastral "Ativa" nos arquivos abertos da Receita. */
export const SITUACAO_CADASTRAL_ATIVA = '02'

export function normalizaCnae(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 7 ? digits.slice(0, 7) : digits
}

export function cnaeQualificado(principal, secundariosCsv) {
  const principalNorm = normalizaCnae(principal)
  if (CNAES_PDV_SET.has(principalNorm)) return principalNorm
  if (!secundariosCsv) return null
  for (const part of String(secundariosCsv).split(',')) {
    const norm = normalizaCnae(part)
    if (CNAES_PDV_SET.has(norm)) return norm
  }
  return null
}
