import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'
import type {
  InsightsClienteComRedeRow,
  InsightsClienteMes,
  InsightsClienteMixRow,
  InsightsCidadeRow,
  InsightsGrupoKind,
  InsightsMesGlobalRow,
  InsightsProdutoDetalhe,
  InsightsProdutoRow,
  InsightsRedeResumoRow,
  InsightsResumoGlobal,
  InsightsTopCliente,
  InsightsUpload,
} from '@/types/insights'
import { parseInsightsClienteBrasilStatus } from '@/lib/insightsClienteBrasilStatus'
import { filterInsightsByNordeste } from '@/lib/insights-territorio'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

/** PostgREST devolve objeto `{ message, code, details }` — não é `Error`. */
export function queryErrorMessage(err: unknown): string {
  if (err == null) return 'Erro desconhecido'
  if (err instanceof Error) return err.message || 'Erro desconhecido'
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const o = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [o.message, o.details, o.hint]
      .map((x) => (x != null && String(x).trim() !== '' ? String(x) : ''))
      .filter(Boolean)
    if (parts.length) return parts.join(' — ')
    if (o.code != null) return `Erro ${String(o.code)}`
  }
  try {
    return JSON.stringify(err)
  } catch {
    return 'Erro desconhecido'
  }
}

function throwQueryError(err: unknown): never {
  throw new Error(queryErrorMessage(err))
}

export function isoDateOnly(d: unknown): string {
  if (d == null) return ''
  const s = String(d)
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10)
}

function formatMesAnoPt(d: Date): string {
  const s = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  return s.replace(/\./g, '')
}

/**
 * Converte ISO date "YYYY-MM-DD" para label legível "mês de YYYY" (ex.: "jan de 2022").
 * Retorna o input se inválido.
 */
export function formatPeriodoLabel(iso: string): string {
  if (!iso || iso === '—') return iso || '—'
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return formatMesAnoPt(d)
}

function periodoFromUploads(rows: InsightsUpload[]): { inicio: string; fim: string } {
  let min: Date | null = null
  let max: Date | null = null
  for (const u of rows) {
    if (u.periodo_inicio) {
      const d = new Date(u.periodo_inicio)
      if (!Number.isNaN(d.getTime()) && (!min || d < min)) min = d
    }
    if (u.periodo_fim) {
      const d = new Date(u.periodo_fim)
      if (!Number.isNaN(d.getTime()) && (!max || d > max)) max = d
    }
  }
  if (!min || !max) return { inicio: '—', fim: '—' }
  return { inicio: min.toISOString().slice(0, 10), fim: max.toISOString().slice(0, 10) }
}

/** Chave canônica 14 dígitos para igualar DB e query params */
export function insightsCnpjKey(raw: string | null | undefined): string {
  const p = parseInsightsCnpj(raw ?? '')
  if (p.ok) return p.cnpj14
  const d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length <= 14) return d.padStart(14, '0')
  return d.slice(-14).padStart(14, '0')
}

export type InsightsBootstrap = {
  cidades: InsightsCidadeRow[]
  clientes: InsightsTopCliente[]
  /** Soma oficial em `nf_itens` e contagens físicas na base (para bater com a planilha). */
  resumoGlobal: InsightsResumoGlobal | null
  kpiGeral: {
    faturamento_total: number
    total_cidades: number
    total_clientes: number
    total_nfs: number
    total_skus: number
  }
  periodo: { inicio: string; fim: string }
}

/** Dados históricos Arruda — cache longo; invalidar só após ingestão/admin. */
const INSIGHTS_STALE_MS = 30 * 60 * 1000

export type InsightsBootstrapCore = Omit<InsightsBootstrap, 'clientes'>

/**
 * Busca todos os clientes da view paginando pelo cap do PostgREST (db.max-rows).
 * Sem isso o Pareto, ranking e KPIs ficavam restritos a 1000 de ~8.5k clientes
 * — distorcendo os charts da aba Clientes do Insights.
 */
const CLIENTES_PAGE_SIZE = 1000
const CLIENTES_SELECT =
  'cnpj_cliente,nome_cliente,razao_social,cidade,estado,faturamento_total,total_nfs,ultima_compra,total_skus,brasil_enriquecimento_status,perfil,grupo_label'

/**
 * View pesada (~1s/página). Paginação em paralelo estourava timeout do PostgREST (500).
 * Sequencial + order estável evita [object Object] / falha do bootstrap.
 */
async function fetchAllInsightsClientes(): Promise<Record<string, unknown>[]> {
  const first = await supabase
    .from('alwayson_insights_v_clientes_com_rede')
    .select(CLIENTES_SELECT, { count: 'exact' })
    .order('cnpj_cliente', { ascending: true })
    .range(0, CLIENTES_PAGE_SIZE - 1)
  if (first.error) throwQueryError(first.error)
  const rows = (first.data ?? []) as Record<string, unknown>[]
  const total = first.count ?? rows.length
  if (rows.length >= total) return rows

  let offset = CLIENTES_PAGE_SIZE
  while (offset < total) {
    const page = await supabase
      .from('alwayson_insights_v_clientes_com_rede')
      .select(CLIENTES_SELECT)
      .order('cnpj_cliente', { ascending: true })
      .range(offset, offset + CLIENTES_PAGE_SIZE - 1)
    if (page.error) throwQueryError(page.error)
    const chunk = (page.data ?? []) as Record<string, unknown>[]
    if (chunk.length === 0) break
    rows.push(...chunk)
    offset += CLIENTES_PAGE_SIZE
  }
  return rows
}

function mapInsightsCidadeRows(cidadeRows: Record<string, unknown>[]): InsightsCidadeRow[] {
  return filterInsightsByNordeste(
    cidadeRows.map((row) => ({
      cidade: String(row.cidade ?? ''),
      estado: String(row.estado ?? ''),
      faturamento_total: n(row.faturamento_total),
      total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
      total_clientes: Math.trunc(Number(row.total_clientes)) || 0,
      ticket_medio_cliente: n(row.ticket_medio_cliente),
      total_skus: Math.trunc(Number(row.total_skus)) || 0,
      quantidade_total: n(row.quantidade_total),
      quantidade_litros: n(row.quantidade_litros),
      unidade_predominante:
        row.unidade_predominante != null && String(row.unidade_predominante).trim() !== ''
          ? String(row.unidade_predominante).trim()
          : undefined,
    }))
  )
}

function mapInsightsClienteRows(clienteRows: Record<string, unknown>[]): InsightsTopCliente[] {
  return filterInsightsByNordeste(
    clienteRows.map((row) => ({
      cnpj_cliente: String(row.cnpj_cliente ?? ''),
      nome_cliente: String(row.nome_cliente ?? '—').trim() || '—',
      razao_social: (() => {
        const r = row.razao_social
        if (r == null) return undefined
        const t = String(r).trim()
        return t || undefined
      })(),
      cidade: row.cidade != null ? String(row.cidade) : undefined,
      estado: row.estado != null ? String(row.estado) : undefined,
      faturamento_total: n(row.faturamento_total),
      total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
      ultima_compra: isoDateOnly(row.ultima_compra),
      total_skus: Math.trunc(Number(row.total_skus)) || 0,
      nome_rede: (() => {
        const g = row.grupo_label
        if (g == null) return undefined
        const t = String(g).trim()
        return t || undefined
      })(),
      perfil: (() => {
        const p = row.perfil
        if (p == null) return undefined
        const t = String(p).trim()
        return t || undefined
      })(),
      brasil_enriquecimento_status: parseInsightsClienteBrasilStatus(row.brasil_enriquecimento_status),
    }))
  ).sort((a, b) => b.faturamento_total - a.faturamento_total)
}

function parseResumoGlobal(resumoGlobalRes: {
  error: unknown
  data: unknown
}): InsightsResumoGlobal | null {
  if (resumoGlobalRes.error || !resumoGlobalRes.data || typeof resumoGlobalRes.data !== 'object') {
    return null
  }
  const rg = resumoGlobalRes.data as Record<string, unknown>
  return {
    total_nfs: Math.trunc(Number(rg.total_nfs)) || 0,
    total_linhas_itens: Math.trunc(Number(rg.total_linhas_itens)) || 0,
    total_cnps_com_nf: Math.trunc(Number(rg.total_cnps_com_nf)) || 0,
    total_cnps_dimensao: Math.trunc(Number(rg.total_cnps_dimensao)) || 0,
    faturamento_soma_linhas_itens: n(rg.faturamento_soma_linhas_itens),
  }
}

function assertInsightsViewsAvailable(cidadesError: unknown) {
  const miss =
    ([cidadesError].find((e) => String((e as { message?: string })?.message ?? '').includes('does not exist')) ??
      [cidadesError].find((e) =>
        String((e as { message?: string })?.message ?? '').includes('schema cache')
      )) ??
    null
  if (miss) {
    throw new Error(
      'Views de Insights não encontradas. Execute as migrations Insights no SQL Editor (≥012 e 015_insights_clientes_dim.sql quando aplicável).'
    )
  }
}

async function fetchInsightsBootstrapCore(): Promise<InsightsBootstrapCore> {
  const [cidadesRes, uploadsRes, skuHeadRes, resumoGlobalRes] = await Promise.all([
    supabase
      .from('alwayson_insights_v_cidades')
      .select('*')
      .order('faturamento_total', { ascending: false }),
    supabase
      .from('alwayson_insights_uploads')
      .select('periodo_inicio, periodo_fim, status, criado_em')
      .eq('status', 'concluido')
      .order('criado_em', { ascending: false }),
    supabase.from('alwayson_insights_v_produtos').select('sku', { count: 'exact', head: true }),
    supabase.from('alwayson_insights_v_resumo_global').select('*').maybeSingle(),
  ])

  const resumoGlobal = parseResumoGlobal(resumoGlobalRes)
  assertInsightsViewsAvailable(cidadesRes.error)
  if (cidadesRes.error) throwQueryError(cidadesRes.error)

  const cidades = mapInsightsCidadeRows((cidadesRes.data ?? []) as Record<string, unknown>[])
  const uploads = (uploadsRes.data ?? []) as InsightsUpload[]
  const periodo = periodoFromUploads(uploads)

  const faturamentoSomadoCidades = cidades.reduce((s, c) => s + c.faturamento_total, 0)
  const total_nfsSomadoCidades = cidades.reduce((s, c) => s + c.total_nfs, 0)

  return {
    cidades,
    resumoGlobal,
    kpiGeral: {
      faturamento_total: resumoGlobal?.faturamento_soma_linhas_itens ?? faturamentoSomadoCidades,
      total_nfs: resumoGlobal?.total_nfs ?? total_nfsSomadoCidades,
      total_clientes: resumoGlobal?.total_cnps_com_nf ?? 0,
      total_cidades: cidades.length,
      total_skus: skuHeadRes.count ?? 0,
    },
    periodo,
  }
}

/** Cidades, KPIs e período — rápido; libera o shell da página. */
export function useInsightsBootstrapCore() {
  return useQuery({
    queryKey: ['insights', 'bootstrap', 'core'],
    staleTime: INSIGHTS_STALE_MS,
    gcTime: 60 * 60 * 1000,
    queryFn: fetchInsightsBootstrapCore,
  })
}

/** ~8k clientes paginados — roda em paralelo após o core. */
export function useInsightsClientes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', 'bootstrap', 'clientes'],
    staleTime: INSIGHTS_STALE_MS,
    gcTime: 60 * 60 * 1000,
    enabled: options?.enabled ?? true,
    queryFn: async () => mapInsightsClienteRows(await fetchAllInsightsClientes()),
  })
}

export function prefetchInsightsBootstrap(queryClient: {
  prefetchQuery: (opts: {
    queryKey: readonly unknown[]
    queryFn: () => Promise<unknown>
    staleTime?: number
  }) => Promise<void>
}) {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['insights', 'bootstrap', 'core'],
      queryFn: fetchInsightsBootstrapCore,
      staleTime: INSIGHTS_STALE_MS,
    }),
    queryClient.prefetchQuery({
      queryKey: ['insights', 'bootstrap', 'clientes'],
      queryFn: async () => mapInsightsClienteRows(await fetchAllInsightsClientes()),
      staleTime: INSIGHTS_STALE_MS,
    }),
  ])
}

/** Bootstrap monolítico — preferir core + clientes separados na UI. */
export function useInsightsBootstrap() {
  return useQuery({
    queryKey: ['insights', 'bootstrap'],
    staleTime: INSIGHTS_STALE_MS,
    queryFn: async (): Promise<InsightsBootstrap> => {
      const [core, clientes] = await Promise.all([
        fetchInsightsBootstrapCore(),
        mapInsightsClienteRows(await fetchAllInsightsClientes()),
      ])
      return {
        ...core,
        clientes,
        kpiGeral: {
          ...core.kpiGeral,
          total_clientes: core.resumoGlobal?.total_cnps_com_nf ?? clientes.length,
        },
      }
    },
  })
}

export function useInsightsClienteHistorico(cnpjRaw: string | undefined) {
  const key = cnpjRaw ? insightsCnpjKey(cnpjRaw) : ''
  return useQuery({
    queryKey: ['insights', 'cliente-mes', key],
    enabled: key.length === 14,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_cliente_mes')
        .select('*')
        .eq('cnpj_cliente', key)
        .order('ano_mes', { ascending: true })
      if (error) throwQueryError(error)
      return (data ?? []).map((row) => ({
        ano_mes: String((row as { ano_mes: string }).ano_mes),
        faturamento: n((row as { faturamento: unknown }).faturamento),
        total_nfs: Math.trunc(Number((row as { total_nfs: unknown }).total_nfs)) || 0,
        total_skus: Math.trunc(Number((row as { total_skus: unknown }).total_skus)) || 0,
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
      })) satisfies InsightsClienteMes[]
    },
  })
}

export function useInsightsClienteMix(cnpjRaw: string | undefined) {
  const key = cnpjRaw ? insightsCnpjKey(cnpjRaw) : ''
  return useQuery({
    queryKey: ['insights', 'cliente-mix', key],
    enabled: key.length === 14,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_cliente_mix')
        .select('*')
        .eq('cnpj_cliente', key)
        .order('faturamento_total', { ascending: false })
      if (error) throwQueryError(error)
      return (data ?? []).map((row) => ({
        sku: String((row as { sku: string }).sku),
        descricao: String((row as { descricao: string | null }).descricao ?? ''),
        meses_ativos: Math.trunc(Number((row as { meses_ativos: unknown }).meses_ativos)) || 0,
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        unidade: String((row as { unidade: string | null }).unidade ?? ''),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        primeira_compra: isoDateOnly((row as { primeira_compra: unknown }).primeira_compra),
        ultima_compra: isoDateOnly((row as { ultima_compra: unknown }).ultima_compra),
      })) satisfies InsightsClienteMixRow[]
    },
  })
}

export function useInsightsProdutos(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', 'produtos'],
    staleTime: 60_000,
    enabled: options?.enabled !== false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_produtos')
        .select('*')
        .order('faturamento_total', { ascending: false })
      if (error) throwQueryError(error)
      return (data ?? []).map((row) => ({
        sku: String((row as { sku: string }).sku),
        descricao:
          String((row as { descricao: string | null }).descricao ?? '').trim() ||
          String((row as { sku: string }).sku),
        categoria: String((row as { categoria: string | null }).categoria ?? '—'),
        marca: String((row as { marca: string | null }).marca ?? '—'),
        detalhamento_categoria: String(
          (row as { detalhamento_categoria: string | null }).detalhamento_categoria ?? '—'
        ),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        unidade: String((row as { unidade: string | null }).unidade ?? ''),
        total_nfs: Math.trunc(Number((row as { total_nfs: unknown }).total_nfs)) || 0,
        total_clientes: Math.trunc(Number((row as { total_clientes: unknown }).total_clientes)) || 0,
        total_cidades: Math.trunc(Number((row as { total_cidades: unknown }).total_cidades)) || 0,
        primeira_venda: isoDateOnly((row as { primeira_venda: unknown }).primeira_venda),
        ultima_venda: isoDateOnly((row as { ultima_venda: unknown }).ultima_venda),
      })) satisfies InsightsProdutoRow[]
    },
  })
}

export function useInsightsMesGlobal(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', 'mes-global'],
    staleTime: 60_000,
    enabled: options?.enabled !== false,
    queryFn: async (): Promise<InsightsMesGlobalRow[]> => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_mes_global')
        .select('*')
        .order('ano_mes', { ascending: true })
      if (error) {
        const msg = queryErrorMessage(error)
        if (msg.includes('does not exist') || msg.includes('schema cache')) {
          return []
        }
        throwQueryError(error)
      }
      return (data ?? []).map((row) => ({
        ano_mes: String((row as { ano_mes: string }).ano_mes),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        total_nfs: Math.trunc(Number((row as { total_nfs: unknown }).total_nfs)) || 0,
        total_clientes: Math.trunc(Number((row as { total_clientes: unknown }).total_clientes)) || 0,
        total_skus: Math.trunc(Number((row as { total_skus: unknown }).total_skus)) || 0,
      })) satisfies InsightsMesGlobalRow[]
    },
  })
}

const PRODUTO_DRILL_TOP = 15
/** Praças na tabela rankeável do detalhe do SKU (ordenado por fat. no banco). */
const PRODUTO_DRILL_CIDADES = 250

export function useInsightsProdutoExpandido(sku: string | null) {
  return useQuery({
    queryKey: ['insights', 'produto-expand', sku],
    enabled: !!sku && sku.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<InsightsProdutoDetalhe> => {
      const resolved = sku!.trim()

      const [cliRes, cidRes, ufRes, mesRes] = await Promise.all([
        supabase
          .from('alwayson_insights_v_produto_clientes')
          .select(
            'cnpj_cliente, nome_cliente, cidade, estado, quantidade_total, faturamento_total, total_nfs, ultima_venda'
          )
          .eq('sku', resolved)
          .order('faturamento_total', { ascending: false })
          .limit(PRODUTO_DRILL_TOP),
        supabase
          .from('alwayson_insights_v_produto_cidades')
          .select('cidade, estado, quantidade_total, faturamento_total, total_clientes')
          .eq('sku', resolved)
          .order('faturamento_total', { ascending: false })
          .limit(PRODUTO_DRILL_CIDADES),
        supabase
          .from('alwayson_insights_v_produto_uf')
          .select('estado, faturamento_total, total_clientes, total_cidades')
          .eq('sku', resolved)
          .order('faturamento_total', { ascending: false }),
        supabase
          .from('alwayson_insights_v_produto_mes')
          .select('ano_mes, faturamento_total, quantidade_total, total_clientes')
          .eq('sku', resolved)
          .order('ano_mes', { ascending: true }),
      ])

      if (cliRes.error) throwQueryError(cliRes.error)
      if (cidRes.error) throwQueryError(cidRes.error)
      if (ufRes.error) throwQueryError(ufRes.error)
      if (mesRes.error) throwQueryError(mesRes.error)

      const topClientes = (cliRes.data ?? []).map((row) => ({
        cnpj_cliente: insightsCnpjKey(String((row as { cnpj_cliente: string }).cnpj_cliente)),
        nome_cliente: String((row as { nome_cliente: string | null }).nome_cliente ?? '—'),
        cidade: String((row as { cidade: string | null }).cidade ?? '—'),
        estado: String((row as { estado: string | null }).estado ?? '—'),
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        total_nfs: Math.trunc(Number((row as { total_nfs: unknown }).total_nfs)) || 0,
        ultima_venda: isoDateOnly((row as { ultima_venda: unknown }).ultima_venda),
      }))

      const topCidadesAll = (cidRes.data ?? []).map((row) => ({
        cidade: String((row as { cidade: string | null }).cidade ?? '—'),
        estado: String((row as { estado: string | null }).estado ?? '—'),
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        total_clientes: Math.trunc(Number((row as { total_clientes: unknown }).total_clientes)) || 0,
      }))

      const porUf = (ufRes.data ?? []).map((row) => ({
        estado: String((row as { estado: string | null }).estado ?? '—'),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        total_clientes: Math.trunc(Number((row as { total_clientes: unknown }).total_clientes)) || 0,
        total_cidades: Math.trunc(Number((row as { total_cidades: unknown }).total_cidades)) || 0,
      }))

      const serieMensal = (mesRes.data ?? []).map((row) => ({
        ano_mes: String((row as { ano_mes: string }).ano_mes),
        faturamento_total: n((row as { faturamento_total: unknown }).faturamento_total),
        quantidade_total: n((row as { quantidade_total: unknown }).quantidade_total),
        total_clientes: Math.trunc(Number((row as { total_clientes: unknown }).total_clientes)) || 0,
      }))

      const oportunidadesCidade = topCidadesAll
        .filter((c) => c.total_clientes >= 8 && c.faturamento_total > 0)
        .map((c) => ({
          cidade: c.cidade,
          estado: c.estado,
          faturamento_total: c.faturamento_total,
          total_clientes: c.total_clientes,
          fat_por_cliente: c.faturamento_total / Math.max(c.total_clientes, 1),
        }))
        .sort((a, b) => a.fat_por_cliente - b.fat_por_cliente)
        .slice(0, 40)

      return {
        topClientes,
        topCidades: topCidadesAll,
        porUf,
        serieMensal,
        oportunidadesCidade,
      }
    },
  })
}

function parseGrupoKind(x: unknown): InsightsGrupoKind {
  return String(x) === 'manual' ? 'manual' : 'raiz'
}

const REDE_RESUMO_PAGE = 1000

function mapRedeResumoRow(row: Record<string, unknown>): InsightsRedeResumoRow {
  const nomeRedeRaw = row.nome_rede
  const nomeRedeTrim =
    nomeRedeRaw != null && String(nomeRedeRaw).trim() !== ''
      ? String(nomeRedeRaw).trim()
      : null
  return {
    grupo_kind: parseGrupoKind(row.grupo_kind),
    grupo_id: String(row.grupo_id ?? ''),
    grupo_label: String(row.grupo_label ?? '—'),
    nome_rede: nomeRedeTrim,
    total_lojas: Math.trunc(Number(row.total_lojas)) || 0,
    faturamento_total: n(row.faturamento_total),
    total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
    ultima_compra: isoDateOnly(row.ultima_compra),
    total_skus: Math.trunc(Number(row.total_skus)) || 0,
    ticket_medio_loja: n(row.ticket_medio_loja),
  }
}

async function fetchAllInsightsRedeResumo(): Promise<InsightsRedeResumoRow[]> {
  const first = await supabase
    .from('alwayson_insights_v_rede_resumo')
    .select('*', { count: 'exact' })
    .order('faturamento_total', { ascending: false })
    .range(0, REDE_RESUMO_PAGE - 1)
  if (first.error) throwQueryError(first.error)
  const rows = (first.data ?? []) as Record<string, unknown>[]
  const total = first.count ?? rows.length
  const out: InsightsRedeResumoRow[] = rows.map(mapRedeResumoRow)
  if (rows.length >= total) return out

  let offset = REDE_RESUMO_PAGE
  while (offset < total) {
    const page = await supabase
      .from('alwayson_insights_v_rede_resumo')
      .select('*')
      .order('faturamento_total', { ascending: false })
      .range(offset, offset + REDE_RESUMO_PAGE - 1)
    if (page.error) throwQueryError(page.error)
    const chunk = page.data ?? []
    if (chunk.length === 0) break
    for (const row of chunk) {
      out.push(mapRedeResumoRow(row as Record<string, unknown>))
    }
    offset += REDE_RESUMO_PAGE
  }
  return out
}

export function useInsightsRedeResumo(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', 'rede-resumo'],
    staleTime: 60_000,
    enabled: options?.enabled !== false,
    queryFn: fetchAllInsightsRedeResumo,
  })
}

function mapClienteComRedeRow(row: Record<string, unknown>): InsightsClienteComRedeRow {
  return {
    cnpj_cliente: String(row.cnpj_cliente ?? ''),
    nome_cliente: String(row.nome_cliente ?? '—').trim() || '—',
    razao_social: (() => {
      const r = row.razao_social
      if (r == null) return undefined
      const t = String(r).trim()
      return t || undefined
    })(),
    cidade: row.cidade != null ? String(row.cidade) : undefined,
    estado: row.estado != null ? String(row.estado) : undefined,
    faturamento_total: n(row.faturamento_total),
    total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
    ultima_compra: isoDateOnly(row.ultima_compra),
    total_skus: Math.trunc(Number(row.total_skus)) || 0,
    perfil: (() => {
      const p = row.perfil
      if (p == null) return undefined
      const t = String(p).trim()
      return t || undefined
    })(),
    cnpj_raiz: String(row.cnpj_raiz ?? ''),
    rede_id: row.rede_id != null ? String(row.rede_id) : null,
    rede_nome: row.rede_nome != null ? String(row.rede_nome) : null,
    grupo_kind: parseGrupoKind(row.grupo_kind),
    grupo_id: String(row.grupo_id ?? ''),
    grupo_label: String(row.grupo_label ?? ''),
  }
}

export function useInsightsFiliaisGrupo(grupoId: string | undefined) {
  return useQuery({
    queryKey: ['insights', 'filiais-grupo', grupoId],
    enabled: !!grupoId && grupoId.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_clientes_com_rede')
        .select('*')
        .eq('grupo_id', grupoId!)
        .order('faturamento_total', { ascending: false })
      if (error) throwQueryError(error)
      return (data ?? []).map((row) => mapClienteComRedeRow(row as Record<string, unknown>))
    },
  })
}

export function clienteComRedeToTopCliente(row: InsightsClienteComRedeRow): InsightsTopCliente {
  return {
    cnpj_cliente: row.cnpj_cliente,
    nome_cliente: row.nome_cliente,
    razao_social: row.razao_social,
    cidade: row.cidade,
    estado: row.estado,
    faturamento_total: row.faturamento_total,
    total_nfs: row.total_nfs,
    ultima_compra: row.ultima_compra,
    total_skus: row.total_skus,
    perfil: row.perfil,
    nome_rede: row.grupo_label?.trim() || undefined,
  }
}
