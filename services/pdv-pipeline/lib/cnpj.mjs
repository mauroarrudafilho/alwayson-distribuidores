export function montaCnpj(basico, ordem, dv) {
  const b = String(basico ?? '').replace(/\D/g, '').padStart(8, '0').slice(-8)
  const o = String(ordem ?? '').replace(/\D/g, '').padStart(4, '0').slice(-4)
  const d = String(dv ?? '').replace(/\D/g, '').padStart(2, '0').slice(-2)
  return `${b}${o}${d}`
}

export function cnpjRaiz(cnpj) {
  return String(cnpj ?? '').replace(/\D/g, '').slice(0, 8)
}
