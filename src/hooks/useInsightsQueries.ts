import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'
import type {
  InsightsClienteMes,
  InsightsClienteMixRow,
  InsightsCidadeRow,
  InsightsProdutoDetalhe,
  InsightsProdutoRow,
  InsightsResumoGlobal,
  InsightsTopCliente,
  InsightsUpload,
} from '@/types/insights'
import { parseInsightsClienteBrasilStatus } from '@/lib/insightsClienteBrasilStatus'

function n(x: unknown): number {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
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

function periodoLabelFromUploads(rows: InsightsUpload[]): { inicio: string; fim: string } {
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
  return { inicio: formatMesAnoPt(min), fim: formatMesAnoPt(max) }
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

export function useInsightsBootstrap() {
  return useQuery({
    queryKey: ['insights', 'bootstrap'],
    staleTime: 60_000,
    queryFn: async (): Promise<InsightsBootstrap> => {
      const [cidadesRes, clientesRes, uploadsRes, skuHeadRes, resumoGlobalRes] = await Promise.all([
        supabase
          .from('alwayson_insights_v_cidades')
          .select('*')
          .order('faturamento_total', { ascending: false }),
        supabase.from('alwayson_insights_v_clientes').select('*'),
        supabase
          .from('alwayson_insights_uploads')
          .select('periodo_inicio, periodo_fim, status, criado_em')
          .eq('status', 'concluido')
          .order('criado_em', { ascending: false }),
        supabase.from('alwayson_insights_v_produtos').select('sku', { count: 'exact', head: true }),
        supabase.from('alwayson_insights_v_resumo_global').select('*').maybeSingle(),
      ])

      /** View 024 opcional até migration aplicada no projeto */
      let resumoGlobal: InsightsResumoGlobal | null = null
      if (
        !resumoGlobalRes.error &&
        resumoGlobalRes.data &&
        typeof resumoGlobalRes.data === 'object'
      ) {
        const rg = resumoGlobalRes.data as Record<string, unknown>
        resumoGlobal = {
          total_nfs: Math.trunc(Number(rg.total_nfs)) || 0,
          total_linhas_itens: Math.trunc(Number(rg.total_linhas_itens)) || 0,
          total_cnps_com_nf: Math.trunc(Number(rg.total_cnps_com_nf)) || 0,
          total_cnps_dimensao: Math.trunc(Number(rg.total_cnps_dimensao)) || 0,
          faturamento_soma_linhas_itens: n(rg.faturamento_soma_linhas_itens),
        }
      }

      const miss =
        [cidadesRes.error, clientesRes.error].find((e) =>
          String(e?.message ?? '').includes('does not exist')
        ) ??
        ([cidadesRes.error, clientesRes.error].find((e) =>
          String(e?.message ?? '').includes('schema cache')
        ) ??
          null)

      if (miss) {
        throw new Error(
          'Views de Insights não encontradas. Execute as migrations Insights no SQL Editor (≥012 e 015_insights_clientes_dim.sql quando aplicável).'
        )
      }
      if (cidadesRes.error) throw cidadesRes.error
      if (clientesRes.error) throw clientesRes.error

      const cidadeRows = (cidadesRes.data ?? []) as Record<string, unknown>[]
      const cidades: InsightsCidadeRow[] = cidadeRows.map((row) => ({
        cidade: String(row.cidade ?? ''),
        estado: String(row.estado ?? ''),
        faturamento_total: n(row.faturamento_total),
        total_nfs: Math.trunc(Number(row.total_nfs)) || 0,
        total_clientes: Math.trunc(Number(row.total_clientes)) || 0,
        ticket_medio_cliente: n(row.ticket_medio_cliente),
        total_skus: Math.trunc(Number(row.total_skus)) || 0,
        quantidade_total: n(row.quantidade_total),
      }))

      const clienteRows = (clientesRes.data ?? []) as Record<string, unknown>[]
      const clientes: InsightsTopCliente[] = clienteRows
        .map((row) => ({
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
          brasil_enriquecimento_status: parseInsightsClienteBrasilStatus(
            row.brasil_enriquecimento_status
          ),
        }))
        .sort((a, b) => b.faturamento_total - a.faturamento_total)

      const uploads = (uploadsRes.data ?? []) as InsightsUpload[]
      const periodo = periodoLabelFromUploads(uploads)

      const faturamentoSomadoCidades = cidades.reduce((s, c) => s + c.faturamento_total, 0)
      const total_nfsSomadoCidades = cidades.reduce((s, c) => s + c.total_nfs, 0)

      /** View 024: totais físicos na base — evita depender só da soma das linhas da view cidades (ex.: paginação). */
      const faturamento_total =
        resumoGlobal?.faturamento_soma_linhas_itens ?? faturamentoSomadoCidades
      const total_nfs = resumoGlobal?.total_nfs ?? total_nfsSomadoCidades
      const total_clientes = resumoGlobal?.total_cnps_com_nf ?? clientes.length

      const total_cidades = cidades.length
      const total_skus = skuHeadRes.count ?? 0

      return {
        cidades,
        clientes,
        resumoGlobal,
        kpiGeral: {
          faturamento_total,
          total_cidades,
          total_clientes,
          total_nfs,
          total_skus,
        },
        periodo,
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
      if (error) throw error
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
      if (error) throw error
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

export function useInsightsProdutos() {
  return useQuery({
    queryKey: ['insights', 'produtos'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_v_produtos')
        .select('*')
        .order('faturamento_total', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => ({
        sku: String((row as { sku: string }).sku),
        descricao:
          String((row as { descricao: string | null }).descricao ?? '').trim() ||
          String((row as { sku: string }).sku),
        categoria: String((row as { categoria: string | null }).categoria ?? '—'),
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

type ItemNfRow = {
  id: string
  sku: string
  codprod_fornecedor?: string | null
  quantidade: string | number | null
  valor_total: string | number | null
  alwayson_insights_nf: {
    cnpj_cliente: string
    nome_cliente: string | null
  } | null
}

/** Espelha COALESCE(NULLIF(TRIM(codprod),''), TRIM(sku)) nas views Insights + de-para. */
function insightsNfItemCodigoOrigem(row: Pick<ItemNfRow, 'sku' | 'codprod_fornecedor'>) {
  const c = (row.codprod_fornecedor ?? '').trim()
  const s = (row.sku ?? '').trim()
  return c !== '' ? c : s
}

function aggregateProdutoDetalhe(
  rows: ItemNfRow[],
  cidadeByCnpj: Map<string, { cidade: string | null; estado: string | null }>
): InsightsProdutoDetalhe {
  type AccC = {
    nome: string
    cidade: string
    estado: string
    qtd: number
    fat: number
  }
  type AccCity = {
    qtd: number
    fat: number
    clientes: Set<string>
  }

  const byCliente = new Map<string, AccC>()
  const byCity = new Map<string, AccCity>()

  for (const r of rows) {
    const nf = r.alwayson_insights_nf
    if (!nf) continue
    const cnpj = insightsCnpjKey(nf.cnpj_cliente)
    const nome = (nf.nome_cliente && nf.nome_cliente.trim()) || '—'
    const ic = cidadeByCnpj.get(cnpj)
    const cidade = (ic?.cidade && ic.cidade.trim()) || '—'
    const estado = (ic?.estado && ic.estado.trim()) || '—'
    const qtd = n(r.quantidade)
    const fat = n(r.valor_total)

    const prev = byCliente.get(cnpj)
    if (prev) {
      prev.qtd += qtd
      prev.fat += fat
    } else {
      byCliente.set(cnpj, { nome, cidade, estado, qtd, fat })
    }

    const ck = `${cidade}|${estado}`
    const cPrev = byCity.get(ck)
    if (cPrev) {
      cPrev.qtd += qtd
      cPrev.fat += fat
      cPrev.clientes.add(cnpj)
    } else {
      byCity.set(ck, { qtd, fat, clientes: new Set([cnpj]) })
    }
  }

  const topClientes = [...byCliente.entries()]
    .map(([cnpj_cliente, v]) => ({
      cnpj_cliente,
      nome_cliente: v.nome,
      cidade: v.cidade,
      estado: v.estado,
      quantidade_total: v.qtd,
      faturamento_total: v.fat,
    }))
    .sort((a, b) => b.faturamento_total - a.faturamento_total)
    .slice(0, 12)

  const topCidades = [...byCity.entries()]
    .map(([key, v]) => {
      const [cidade, estado] = key.split('|')
      return {
        cidade: cidade ?? '—',
        estado: estado ?? '—',
        quantidade_total: v.qtd,
        faturamento_total: v.fat,
        total_clientes: v.clientes.size,
      }
    })
    .sort((a, b) => b.faturamento_total - a.faturamento_total)
    .slice(0, 12)

  return { topClientes, topCidades }
}

export function useInsightsProdutoExpandido(sku: string | null) {
  return useQuery({
    queryKey: ['insights', 'produto-expand', sku],
    enabled: !!sku && sku.length > 0,
    queryFn: async () => {
      const resolved = sku!.trim()
      const { data: deparaRows, error: deparaErr } = await supabase
        .from('alwayson_insights_produto_de_para')
        .select('codigo_origem')
        .eq('sku_fornecedor', resolved)
      if (deparaErr) throw deparaErr

      const originKeys = new Set<string>([resolved])
      for (const r of deparaRows ?? []) {
        const o = String((r as { codigo_origem: string }).codigo_origem ?? '').trim()
        if (o) originKeys.add(o)
      }
      const keyList = [...originKeys].filter(Boolean)

      const select = `
          id,
          sku,
          codprod_fornecedor,
          quantidade,
          valor_total,
          alwayson_insights_nf!inner (
            cnpj_cliente,
            nome_cliente
          )
        `

      const [resSku, resCod] = await Promise.all([
        supabase.from('alwayson_insights_nf_itens').select(select).in('sku', keyList),
        supabase.from('alwayson_insights_nf_itens').select(select).in('codprod_fornecedor', keyList),
      ])
      if (resSku.error) throw resSku.error
      if (resCod.error) throw resCod.error

      const byId = new Map<string, ItemNfRow>()
      for (const row of resSku.data ?? []) {
        byId.set(String((row as { id: string }).id), row as unknown as ItemNfRow)
      }
      for (const row of resCod.data ?? []) {
        byId.set(String((row as { id: string }).id), row as unknown as ItemNfRow)
      }

      const rows = [...byId.values()].filter((row) =>
        originKeys.has(insightsNfItemCodigoOrigem(row))
      )
      const keys = [
        ...new Set(
          rows
            .map((x) => insightsCnpjKey(x.alwayson_insights_nf?.cnpj_cliente ?? ''))
            .filter((k) => k.length === 14)
        ),
      ]
      const cidadeByCnpj = new Map<string, { cidade: string | null; estado: string | null }>()
      if (keys.length) {
        const { data: geoData, error: geoErr } = await supabase
          .from('alwayson_insights_clientes')
          .select('cnpj_14, cidade, estado')
          .in('cnpj_14', keys)
        if (geoErr) throw geoErr
        for (const g of geoData ?? []) {
          const k = insightsCnpjKey((g as { cnpj_14: string }).cnpj_14)
          cidadeByCnpj.set(k, {
            cidade: (g as { cidade: string | null }).cidade ?? null,
            estado: (g as { estado: string | null }).estado ?? null,
          })
        }
      }
      return aggregateProdutoDetalhe(rows, cidadeByCnpj)
    },
  })
}
