export const EXPLORAR_VERSAO_MODELO = 'consolidacao_v2'

export const PDV_SEGMENTO_LABEL: Record<string, string> = {
  subexplorado: 'Subexplorado',
  maduro: 'Maduro',
  revisar_cadastro: 'Revisar cadastro',
  reduzir: 'Reduzir',
  nao_atendido: 'Não atendido',
}

export function nomePdv(
  nomeFantasia: string | null | undefined,
  razaoSocial: string | null | undefined
): string {
  return (nomeFantasia?.trim() || razaoSocial?.trim() || 'Sem nome').slice(0, 120)
}

/** Só plotar ponto quando geocode CNEFE for razoável. */
export function geoConfiavelMapa(nivel: string | null | undefined): boolean {
  return nivel === 'numero_exato' || nivel === 'logradouro'
}

export function pdvTemCoordenada(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
}

/** Mapa principal: só geo CNEFE confiável. Drawer: qualquer coordenada válida. */
export function pdvPlotavelMapa(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  nivel: string | null | undefined,
  opts: { exigirConfiavel?: boolean } = {}
): boolean {
  if (!pdvTemCoordenada(latitude, longitude)) return false
  if (opts.exigirConfiavel) return geoConfiavelMapa(nivel)
  return true
}

/** Índice de relevância 0–100 (consolidacao_v1) — não é valor em R$. */
export function formatIndiceRelevancia(valor: number | null | undefined): string {
  const n = Math.round(Number(valor) || 0)
  return `${n}/100`
}

/** Raio absoluto 0–100 (índice consolidacao_v1) — escala compacta para leitura do mapa. */
export function raioMapaAbsoluto(
  relevancia: number,
  opts: { minRaio?: number; maxRaio?: number } = {}
): number {
  const minRaio = opts.minRaio ?? 2.5
  const maxRaio = opts.maxRaio ?? 10
  const t = Math.max(0, Math.min(1, (Number(relevancia) || 0) / 100))
  return minRaio + Math.pow(t, 0.7) * (maxRaio - minRaio)
}

/** Raio relativo ao recorte (legado) — preferir raioMapaAbsoluto quando índice é 0–100. */
export function raioMapaPorRelevancia(
  relevancia: number,
  min: number,
  max: number,
  opts: { minRaio?: number; maxRaio?: number } = {}
): number {
  const minRaio = opts.minRaio ?? 5
  const maxRaio = opts.maxRaio ?? 20
  if (max <= min) return (minRaio + maxRaio) / 2
  const t = Math.max(0, Math.min(1, (relevancia - min) / (max - min)))
  return minRaio + Math.sqrt(t) * (maxRaio - minRaio)
}

export function faixaRelevanciaLabel(faixa: string | null | undefined): string {
  if (!faixa) return '—'
  return `Faixa ${faixa}`
}

/** Quartis do índice de consolidação dentro da cidade (não é faturamento). */
export const PDV_FAIXA_PRIORIDADE: readonly {
  faixa: 'A' | 'B' | 'C' | 'D'
  quartil: string
  resumo: string
}[] = [
  { faixa: 'A', quartil: 'Top 25%', resumo: 'maior consolidação na praça' },
  { faixa: 'B', quartil: '25–50%', resumo: 'consolidação acima da mediana' },
  { faixa: 'C', quartil: '50–75%', resumo: 'perfil típico da praça' },
  { faixa: 'D', quartil: '75–100%', resumo: 'menor sinal de rede/maturidade' },
]

export const PDV_FAIXA_PRIORIDADE_TEXTO =
  'Faixas A–D são quartis do índice de consolidação (rede de lojas + tempo de operação) calculados dentro da cidade. A e B concentram os PDVs com maior probabilidade de estar consolidados — prioridade natural para conquista ou desenvolvimento.'

/** Posição no ranking (01, 02, …) — alinhado ao Insights. */
export function formatExplorarRank(posicao: number): string {
  return String(posicao).padStart(2, '0')
}
