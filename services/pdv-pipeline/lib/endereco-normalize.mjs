const TIPO_ABREV = {
  R: 'RUA',
  RUA: 'RUA',
  AV: 'AVENIDA',
  AVENIDA: 'AVENIDA',
  AL: 'ALAMEDA',
  ALAMEDA: 'ALAMEDA',
  TV: 'TRAVESSA',
  TRAVESSA: 'TRAVESSA',
  EST: 'ESTRADA',
  ESTRADA: 'ESTRADA',
  ROD: 'RODOVIA',
  RODOVIA: 'RODOVIA',
  PCA: 'PRACA',
  PRACA: 'PRACA',
  LGO: 'LARGO',
  LARGO: 'LARGO',
}

export function normalizeTextoEndereco(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizaLogradouro(raw) {
  const norm = normalizeTextoEndereco(raw)
  if (!norm) return ''
  const parts = norm.split(' ')
  const first = parts[0]
  if (TIPO_ABREV[first]) {
    parts[0] = TIPO_ABREV[first]
  }
  return parts.join(' ')
}

export function normalizaCep(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : digits.padStart(8, '0')
}

/** Número para casamento — ignora S/N e normaliza zeros à esquerda. */
export function normalizaNumero(raw) {
  const s = String(raw ?? '').trim().toUpperCase()
  if (!s || s === 'S/N' || s === 'SN' || s === '0') return null
  const digits = s.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? String(n) : null
}

export function montaLogradouroCnefe(tipo, titulo, nome) {
  return normalizaLogradouro([tipo, titulo, nome].filter(Boolean).join(' '))
}

export function chaveExact(logradouro, numero, cep) {
  const log = normalizaLogradouro(logradouro)
  const num = normalizaNumero(numero)
  const c = normalizaCep(cep)
  if (!log || !num || !c) return null
  return `${log}|${num}|${c}`
}

export function chaveLogCep(logradouro, cep) {
  const log = normalizaLogradouro(logradouro)
  const c = normalizaCep(cep)
  if (!log || !c) return null
  return `${log}|${c}`
}
