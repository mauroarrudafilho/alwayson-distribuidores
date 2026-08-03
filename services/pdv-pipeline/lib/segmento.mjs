/**
 * Segmentação carteira × relevância (consolidacao_v1).
 * Faixas A/B = PDV com maior probabilidade de consolidação na região.
 * Comparação de sell-in usa mediana da carteira A/B — não palpite de faturamento.
 */

export function medianaCompraCarteiraAb(universo, clientesPorCnpj, compraPorClienteId) {
  const valores = []
  for (const u of universo) {
    if (u.faixa !== 'A' && u.faixa !== 'B') continue
    const cliente = clientesPorCnpj.get(u.cnpj)
    if (!cliente) continue
    const compra = Number(compraPorClienteId.get(cliente.id)) || 0
    if (compra > 0) valores.push(compra)
  }
  if (!valores.length) return 0
  valores.sort((a, b) => a - b)
  const mid = Math.floor(valores.length / 2)
  return valores.length % 2 === 0
    ? (valores[mid - 1] + valores[mid]) / 2
    : valores[mid]
}

export function classificarSegmento({ faixa, compraMedia, medianaCompraAb }) {
  const compra = Number(compraMedia) || 0
  const mediana = Number(medianaCompraAb) || 0
  const relevanciaAlta = faixa === 'A' || faixa === 'B'

  if (relevanciaAlta) {
    if (mediana > 0 && compra < mediana * 0.5) return 'subexplorado'
    return 'maduro'
  }

  if (mediana > 0 && compra > mediana * 1.5 && compra > 500) return 'revisar_cadastro'
  return 'reduzir'
}

/** Gap vs mediana da carteira A/B (R$), só quando faz sentido comparar sell-in. */
export function calcularGap(_indiceRelevancia, compraMedia, medianaCompraAb, faixa) {
  const compra = Number(compraMedia) || 0
  const mediana = Number(medianaCompraAb) || 0
  const relevanciaAlta = faixa === 'A' || faixa === 'B'
  if (!relevanciaAlta || mediana <= 0) return null
  return Math.max(0, Number((mediana - compra).toFixed(2)))
}

export function calcularPercentualPotencial(_indiceRelevancia, compraMedia, medianaCompraAb, faixa) {
  const compra = Number(compraMedia) || 0
  const mediana = Number(medianaCompraAb) || 0
  const relevanciaAlta = faixa === 'A' || faixa === 'B'
  if (!relevanciaAlta || mediana <= 0) return null
  return Number(((compra / mediana) * 100).toFixed(2))
}
