import type { ClientTagCategory } from '@/components/distribuidor/ClientTag'
import type { CidadePerCapita } from '@/lib/insights-per-capita'
import type { InsightsTopCliente } from '@/types/insights'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'

function cnpjKey(raw: string | null | undefined): string {
  const p = parseInsightsCnpj(raw ?? '')
  if (p.ok) return p.cnpj14
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 14) return d
  if (d.length > 0 && d.length < 14) return d.padStart(14, '0')
  return d.slice(-14).padStart(14, '0')
}

/** Escala mínima do pool da referência de potencial. */
const POOL_MIN_POP = 5_000
const POOL_MIN_CLIENTES_LIMPOS = 2
const BENCH_PERCENTILE = 0.9
const SUGGEST_CLIENTES_LIMIT = 50

export type GapStatusNivel =
  | 'referencia'
  | 'gap_baixo'
  | 'gap_medio'
  | 'gap_alto'
  | 'sem_dados'

export type GapBenchmark = {
  cidade: string
  estado: string
  faturamento_per_capita: number
  faturamento_total: number
  populacao: number
  total_clientes: number
  pool_size: number
  metodo: string
  /** CNPJs excluídos do potencial (parametrização). */
  excluded_clientes: number
}

export type ClientePotencialExclusao = {
  cnpj: string
  nome: string
  cidade?: string
  estado?: string
  faturamento_total: number
  reasons: string[]
  score: number
}

export type CidadeFatLimpo = {
  cidade: string
  estado: string
  /** Soma só de clientes que entram na conta de potencial. */
  faturamento_limpo: number
  total_clientes_limpos: number
  /** Fat. dos CNPJs excluídos nesta cidade. */
  faturamento_excluido: number
}

export type CidadeGapPerCapita = CidadePerCapita & {
  benchmark: GapBenchmark
  /** Fat. da cidade sem clientes excluídos (base do potencial/ranking). */
  faturamento_limpo: number
  faturamento_per_capita_limpo: number
  total_clientes_limpos: number
  potencial_faturamento: number
  gap_faturamento: number
  atingido_pct: number
  nivel: GapStatusNivel
  label: string
  category: ClientTagCategory
  /** Houve exclusão de cliente afetando esta cidade. */
  tem_exclusao: boolean
}

export function cidadeGapKey(cidade: string, estado: string): string {
  return `${cidade.trim().toLowerCase()}\t${estado.trim().toUpperCase()}`
}

function percentileSorted(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  if (sortedAsc.length === 1) return sortedAsc[0]!
  const idx = (sortedAsc.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedAsc[lo]!
  const t = idx - lo
  return sortedAsc[lo]! * (1 - t) + sortedAsc[hi]! * t
}

/**
 * Fat. por cidade ignorando CNPJs excluídos da parametrização de potencial.
 * Não altera o fat./hab exibido (view completa).
 */
export function buildCidadesFatLimpo(
  clientes: InsightsTopCliente[],
  excludedCnpjs: ReadonlySet<string>
): Map<string, CidadeFatLimpo> {
  const m = new Map<string, CidadeFatLimpo>()
  for (const c of clientes) {
    const cidade = (c.cidade ?? '').trim() || '— sem cidade —'
    const estado = (c.estado ?? '').trim() || '—'
    const key = cidadeGapKey(cidade, estado)
    let row = m.get(key)
    if (!row) {
      row = {
        cidade,
        estado,
        faturamento_limpo: 0,
        total_clientes_limpos: 0,
        faturamento_excluido: 0,
      }
      m.set(key, row)
    }
    const cnpj = cnpjKey(c.cnpj_cliente)
    if (cnpj.length === 14 && excludedCnpjs.has(cnpj)) {
      row.faturamento_excluido += c.faturamento_total
    } else {
      row.faturamento_limpo += c.faturamento_total
      row.total_clientes_limpos += 1
    }
  }
  return m
}

/**
 * Sugere CNPJs que costumam distorcer potencial (hubs / concentração).
 * Usa agregados dos próprios clientes (não depende de IBGE carregado).
 * População IBGE, se houver, só refina o motivo.
 */
export function suggestClientesExclusaoPotencial(
  clientes: InsightsTopCliente[],
  cidadesComPop?: CidadePerCapita[]
): ClientePotencialExclusao[] {
  if (clientes.length === 0) return []

  /** Fat e nº de clientes por cidade — sempre a partir da carteira. */
  const cityAgg = new Map<string, { fat: number; n: number }>()
  for (const c of clientes) {
    const key = cidadeGapKey(c.cidade ?? '', c.estado ?? '')
    const row = cityAgg.get(key) ?? { fat: 0, n: 0 }
    row.fat += c.faturamento_total
    row.n += 1
    cityAgg.set(key, row)
  }

  const popByKey = new Map(
    (cidadesComPop ?? []).map((c) => [cidadeGapKey(c.cidade, c.estado), c.populacao] as const)
  )

  const fats = clientes.map((c) => c.faturamento_total).sort((a, b) => a - b)
  const p90Cli = percentileSorted(fats, 0.9)
  const p95Cli = percentileSorted(fats, 0.95)

  const byCnpj = new Map<string, ClientePotencialExclusao>()

  for (const c of clientes) {
    const cnpj = cnpjKey(c.cnpj_cliente)
    if (cnpj.length !== 14) continue
    const key = cidadeGapKey(c.cidade ?? '', c.estado ?? '')
    const agg = cityAgg.get(key)
    const cityFat = agg?.fat ?? 0
    const cityCli = agg?.n ?? 0
    const pop = popByKey.get(key)
    const share = cityFat > 0 ? c.faturamento_total / cityFat : 0

    const reasons: string[] = []
    let score = 0

    if (cityCli > 0 && cityCli <= 5 && c.faturamento_total >= 50_000) {
      reasons.push(`cidade com só ${cityCli} cliente(s) no histórico`)
      score += 35
    }
    if (share >= 0.5 && c.faturamento_total >= 40_000) {
      reasons.push(`${Math.round(share * 100)}% do fat. da cidade`)
      score += 30
    }
    if (pop != null && pop < 20_000 && c.faturamento_total >= p90Cli * 0.4) {
      reasons.push('alto volume em município < 20k hab.')
      score += 30
    }
    if (c.faturamento_total >= p95Cli) {
      reasons.push('entre os 5% maiores faturamentos')
      score += 25
    } else if (c.faturamento_total >= p90Cli) {
      reasons.push('entre os 10% maiores faturamentos')
      score += 18
    }

    if (reasons.length === 0 || score < 25) continue

    const prev = byCnpj.get(cnpj)
    if (prev && prev.score >= score) continue

    byCnpj.set(cnpj, {
      cnpj,
      nome: c.nome_cliente?.trim() || c.razao_social?.trim() || cnpj,
      cidade: c.cidade,
      estado: c.estado,
      faturamento_total: c.faturamento_total,
      reasons,
      score,
    })
  }

  let scored = [...byCnpj.values()].sort(
    (a, b) => b.score - a.score || b.faturamento_total - a.faturamento_total
  )

  /** Fallback: top faturamento para sempre haver lista revisável. */
  if (scored.length < 15) {
    const have = new Set(scored.map((s) => s.cnpj))
    const top = [...clientes]
      .map((c) => ({ c, cnpj: cnpjKey(c.cnpj_cliente) }))
      .filter(({ cnpj }) => cnpj.length === 14 && !have.has(cnpj))
      .sort((a, b) => b.c.faturamento_total - a.c.faturamento_total)
      .slice(0, 20)
    for (const { c, cnpj } of top) {
      scored.push({
        cnpj,
        nome: c.nome_cliente?.trim() || c.razao_social?.trim() || cnpj,
        cidade: c.cidade,
        estado: c.estado,
        faturamento_total: c.faturamento_total,
        reasons: ['alto faturamento — revisar se é hub/distribuidor'],
        score: 20,
      })
    }
    scored = scored.sort(
      (a, b) => b.score - a.score || b.faturamento_total - a.faturamento_total
    )
  }

  return scored.slice(0, SUGGEST_CLIENTES_LIMIT)
}

function nivelFromAtingido(
  atingidoPct: number,
  isBenchmarkCity: boolean
): { nivel: GapStatusNivel; label: string; category: ClientTagCategory } {
  if (isBenchmarkCity || atingidoPct >= 85) {
    return { nivel: 'referencia', label: 'Referência', category: 'destaque' }
  }
  if (atingidoPct >= 50) {
    return { nivel: 'gap_baixo', label: 'Gap baixo', category: 'programa' }
  }
  if (atingidoPct >= 25) {
    return { nivel: 'gap_medio', label: 'Gap médio', category: 'flag' }
  }
  return { nivel: 'gap_alto', label: 'Gap alto', category: 'risk' }
}

export function pickBenchmarkFatPc(
  cidades: CidadePerCapita[],
  fatLimpo: Map<string, CidadeFatLimpo>,
  excludedClientesCount: number
): GapBenchmark | null {
  type Row = {
    cidade: string
    estado: string
    fat_pc_limpo: number
    fat_limpo: number
    pop: number
    cli: number
  }

  const pool: Row[] = []
  for (const c of cidades) {
    const limpo = fatLimpo.get(cidadeGapKey(c.cidade, c.estado))
    /** Sem linhas de cliente na chave: usa o fat. da cidade (nada a limpar). */
    const fat = limpo ? limpo.faturamento_limpo : c.faturamento_total
    const cli = limpo ? limpo.total_clientes_limpos : c.total_clientes
    if (c.populacao < POOL_MIN_POP || cli < POOL_MIN_CLIENTES_LIMPOS || fat <= 0) continue
    pool.push({
      cidade: c.cidade,
      estado: c.estado,
      fat_pc_limpo: fat / c.populacao,
      fat_limpo: fat,
      pop: c.populacao,
      cli,
    })
  }
  if (pool.length === 0) return null

  const fats = pool.map((r) => r.fat_pc_limpo).sort((a, b) => a - b)
  const refFatPc = percentileSorted(fats, BENCH_PERCENTILE)
  const anchor = pool.reduce((best, r) =>
    Math.abs(r.fat_pc_limpo - refFatPc) < Math.abs(best.fat_pc_limpo - refFatPc) ? r : best
  )

  return {
    cidade: anchor.cidade,
    estado: anchor.estado,
    faturamento_per_capita: refFatPc,
    faturamento_total: anchor.fat_limpo,
    populacao: anchor.pop,
    total_clientes: anchor.cli,
    pool_size: pool.length,
    excluded_clientes: excludedClientesCount,
    metodo: `P${Math.round(BENCH_PERCENTILE * 100)} fat./hab limpo · exclusões de cliente`,
  }
}

export function computeCidadeGap(
  c: CidadePerCapita,
  benchmark: GapBenchmark,
  limpo: CidadeFatLimpo | undefined
): CidadeGapPerCapita {
  const fatLimpo = limpo ? limpo.faturamento_limpo : c.faturamento_total
  const cliLimpos = limpo ? limpo.total_clientes_limpos : c.total_clientes
  const fatPcLimpo = c.populacao > 0 ? fatLimpo / c.populacao : 0
  const potencial = c.populacao * benchmark.faturamento_per_capita
  /** Gap, status e ranking usam fat. limpo (sem clientes da parametrização). */
  const gap = Math.max(0, potencial - fatLimpo)
  const atingido = potencial > 0 ? (fatLimpo / potencial) * 100 : 0
  const isBench =
    c.cidade === benchmark.cidade &&
    c.estado.toUpperCase() === benchmark.estado.toUpperCase() &&
    fatLimpo > 0
  const { nivel, label, category } = nivelFromAtingido(atingido, isBench)

  return {
    ...c,
    benchmark,
    faturamento_limpo: fatLimpo,
    faturamento_per_capita_limpo: fatPcLimpo,
    total_clientes_limpos: cliLimpos,
    potencial_faturamento: potencial,
    gap_faturamento: gap,
    atingido_pct: atingido,
    nivel,
    label,
    category,
    tem_exclusao: (limpo?.faturamento_excluido ?? 0) > 0,
  }
}

/** Ranking de oportunidade com base limpa (respeita exclusões de cliente). */
export function oportunidadePerCapitaScoreLimpo(c: CidadeGapPerCapita): number {
  return (
    c.faturamento_per_capita_limpo *
    Math.log10(c.faturamento_limpo + 10) *
    Math.log(c.total_clientes_limpos + 1)
  )
}

export function topOportunidadePerCapitaLimpo(
  rows: CidadeGapPerCapita[],
  limit = 24
): CidadeGapPerCapita[] {
  return [...rows]
    .filter(
      (c) =>
        c.populacao >= 2_000 &&
        c.total_clientes_limpos >= 2 &&
        c.faturamento_limpo > 0
    )
    .sort((a, b) => oportunidadePerCapitaScoreLimpo(b) - oportunidadePerCapitaScoreLimpo(a))
    .slice(0, limit)
}

export type GapsContext = {
  benchmark: GapBenchmark | null
  rows: CidadeGapPerCapita[]
  byKey: Map<string, CidadeGapPerCapita>
  excludedCnpjs: ReadonlySet<string>
  fatLimpo: Map<string, CidadeFatLimpo>
}

export function buildGapsContext(
  cidades: CidadePerCapita[],
  clientes: InsightsTopCliente[],
  excludedCnpjs: ReadonlySet<string>
): GapsContext {
  const fatLimpo = buildCidadesFatLimpo(clientes, excludedCnpjs)
  const benchmark = pickBenchmarkFatPc(cidades, fatLimpo, excludedCnpjs.size)
  if (!benchmark) {
    return {
      benchmark: null,
      rows: [],
      byKey: new Map(),
      excludedCnpjs,
      fatLimpo,
    }
  }
  const rows = cidades.map((c) =>
    computeCidadeGap(c, benchmark, fatLimpo.get(cidadeGapKey(c.cidade, c.estado)))
  )
  const byKey = new Map(rows.map((r) => [cidadeGapKey(r.cidade, r.estado), r]))
  return { benchmark, rows, byKey, excludedCnpjs, fatLimpo }
}

export function lookupCidadeGap(
  ctx: GapsContext,
  cidade: string,
  estado: string
): CidadeGapPerCapita | null {
  return ctx.byKey.get(cidadeGapKey(cidade, estado)) ?? null
}

export function topMaioresGaps(rows: CidadeGapPerCapita[], limit = 18): CidadeGapPerCapita[] {
  return [...rows]
    .filter(
      (r) =>
        r.nivel !== 'referencia' &&
        r.gap_faturamento > 0 &&
        r.populacao >= POOL_MIN_POP &&
        r.total_clientes_limpos >= POOL_MIN_CLIENTES_LIMPOS &&
        r.faturamento_limpo > 0
    )
    .sort((a, b) => b.gap_faturamento - a.gap_faturamento)
    .slice(0, limit)
}

export function formatAtingidoPct(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
}

export function describeBenchmarkRule(b: GapBenchmark | null | undefined): string {
  if (!b) return 'Sem pool suficiente para referência de potencial.'
  return `${b.metodo} · ${b.pool_size} cidades · ${b.excluded_clientes} cliente(s) fora do potencial`
}
