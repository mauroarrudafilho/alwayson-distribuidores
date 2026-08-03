import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthEnd, monthStart } from '@/lib/periodo'
import type { Meta } from '@/types/distribuidor'

/**
 * Meta com os campos derivados da view `alwayson_metas_v_acompanhamento`
 * (migration 045). `valor_realizado` e `percentual_atingimento` são calculados
 * a partir do faturamento — nunca gravados —, então acompanham automaticamente
 * cada novo arquivo de vendas ingerido.
 */
export interface MetaAcompanhamento extends Meta {
  observacao: string | null
  criado_por: string | null
  criado_em: string | null
  atualizado_por: string | null
  atualizado_em: string | null
  /** Soma das metas dos filhos diretos (mesmo tipo e período) — sugestão de rollup. */
  valor_rollup_filhos: number | null
  qtd_filhos_com_meta: number | null
  /**
   * `valor_meta - valor_rollup_filhos`. Num supervisor/gerente é a parcela de
   * venda direta — o que ele vende sem passar por um vendedor da equipe.
   * Negativo significa que os filhos somam mais do que a meta do nível.
   */
  diferenca_rollup: number | null
}

export interface MetaComNomes extends MetaAcompanhamento {
  distribuidor_nome: string
  vendedor_nome: string | null
  /** Vendedor da hierarquia ou responsável comercial do distribuidor (meta de distribuidor). */
  responsavel_nome: string
}

const KEY = 'metas' as const
const VIEW = 'alwayson_metas_v_acompanhamento'
const TABELA = 'alwayson_metas_distribuidor'

interface NomesMetas {
  distribuidores: Map<string, string>
  responsaveis: Map<string, string>
  vendedores: Map<string, string>
}

/** Nome exibido na coluna Responsável — alinhado ao cadastro de parceiros. */
export function nomeResponsavelMeta(
  m: Pick<Meta, 'hierarquia' | 'vendedor_id' | 'distribuidor_id'>,
  nomes: NomesMetas
): string {
  if (m.hierarquia === 'distribuidor' || !m.vendedor_id) {
    return nomes.responsaveis.get(m.distribuidor_id) ?? '—'
  }
  return nomes.vendedores.get(m.vendedor_id) ?? '—'
}

function enriquecerMeta(m: MetaAcompanhamento, nomes: NomesMetas): MetaComNomes {
  return {
    ...m,
    distribuidor_nome: nomes.distribuidores.get(m.distribuidor_id) ?? '—',
    vendedor_nome: m.vendedor_id ? (nomes.vendedores.get(m.vendedor_id) ?? '—') : null,
    responsavel_nome: nomeResponsavelMeta(m, nomes),
  }
}

/**
 * Nomes resolvidos por query separada em vez de embed do PostgREST: o embed a
 * partir de uma *view* depende de inferência de relacionamento e quebraria a
 * tela se falhasse. As duas tabelas são pequenas (1 distribuidor, 64 vendedores).
 */
async function buscarNomes(): Promise<NomesMetas> {
  const [dist, vend] = await Promise.all([
    supabase.from('alwayson_distribuidores').select('id, nome, responsavel'),
    supabase.from('alwayson_vendedores_distribuidor').select('id, nome'),
  ])
  if (dist.error) throw dist.error
  if (vend.error) throw vend.error
  return {
    distribuidores: new Map((dist.data ?? []).map((d) => [d.id as string, d.nome as string])),
    responsaveis: new Map(
      (dist.data ?? []).map((d) => [d.id as string, (d.responsavel as string)?.trim() || '—'])
    ),
    vendedores: new Map((vend.data ?? []).map((v) => [v.id as string, v.nome as string])),
  }
}

export function useMetas() {
  return useQuery({
    queryKey: [KEY, 'admin'],
    queryFn: async (): Promise<MetaComNomes[]> => {
      const [{ data, error }, nomes] = await Promise.all([
        supabase.from(VIEW).select('*').order('periodo_inicio', { ascending: false }),
        buscarNomes(),
      ])
      if (error) throw error
      return (data as unknown as MetaAcompanhamento[]).map((m) => enriquecerMeta(m, nomes))
    },
  })
}

export interface MetaInput {
  distribuidor_id: string
  /** Null para a meta do próprio distribuidor. */
  vendedor_id: string | null
  hierarquia: Meta['hierarquia']
  tipo: Meta['tipo']
  periodo_inicio: string
  periodo_fim: string
  valor_meta: number
  observacao?: string | null
}

async function upsertMetaRecord(input: MetaInput, userId: string | null) {
  let busca = supabase
    .from(TABELA)
    .select('id')
    .eq('distribuidor_id', input.distribuidor_id)
    .eq('tipo', input.tipo)
    .eq('periodo_inicio', input.periodo_inicio)
    .eq('periodo_fim', input.periodo_fim)

  busca = input.vendedor_id
    ? busca.eq('vendedor_id', input.vendedor_id)
    : busca.is('vendedor_id', null)

  const { data: existente, error: erroBusca } = await busca.maybeSingle()
  if (erroBusca) throw erroBusca

  if (existente?.id) {
    const { error } = await supabase
      .from(TABELA)
      .update({
        hierarquia: input.hierarquia,
        valor_meta: input.valor_meta,
        observacao: input.observacao ?? null,
        atualizado_por: userId,
      })
      .eq('id', existente.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from(TABELA).insert({
    ...input,
    observacao: input.observacao ?? null,
    criado_por: userId,
    atualizado_por: userId,
  })
  if (error) throw error
}

/**
 * Grava a meta respeitando a chave natural da migration 045
 * (vendedor|distribuidor + tipo + período) — re-gravar substitui, não duplica.
 *
 * Usa select→update/insert em vez de `.upsert()`: as unique keys são índices
 * **parciais**, e o supabase-js não expressa o predicado `WHERE` que o Postgres
 * exige para inferir o índice no `ON CONFLICT`. Mesmo padrão de
 * `useUpsertInsightsAcao`.
 */
export function useUpsertMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MetaInput) => {
      const { data: userResp } = await supabase.auth.getUser()
      await upsertMetaRecord(input, userResp.user?.id ?? null)
    },
    onSuccess: invalidarMetas(qc),
  })
}

/** Grava várias metas em sequência (fluxo top-down ou importação). */
export function useBulkUpsertMetas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inputs: MetaInput[]) => {
      const { data: userResp } = await supabase.auth.getUser()
      const userId = userResp.user?.id ?? null
      for (const input of inputs) {
        await upsertMetaRecord(input, userId)
      }
    },
    onSuccess: invalidarMetas(qc),
  })
}

/**
 * Faturamento ou clientes positivados por vendedor — base proporcional top-down.
 * `mesReferencia` é o mês civil (YYYY-MM) cujo realizado será usado como proporção.
 */
export function useHistoricoEquipe(params: {
  distribuidorId?: string
  mesReferencia?: string
  tipo?: Meta['tipo']
  enabled?: boolean
}) {
  const { distribuidorId, mesReferencia, tipo = 'faturamento', enabled = true } = params
  return useQuery({
    queryKey: [KEY, 'hist-equipe', distribuidorId, mesReferencia, tipo],
    enabled:
      enabled &&
      !!distribuidorId &&
      !!mesReferencia &&
      tipo !== 'mix' &&
      tipo !== 'clientes_estrategicos',
    queryFn: async (): Promise<Map<string, number>> => {
      const inicio = monthStart(mesReferencia!)
      const fim = monthEnd(mesReferencia!)

      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('vendedor_id, valor_total, cliente_id')
        .eq('distribuidor_id', distribuidorId!)
        .gte('data_emissao', inicio)
        .lte('data_emissao', fim)

      if (error) throw error

      if (tipo === 'positivacao') {
        const porVendedor = new Map<string, Set<string>>()
        for (const row of data ?? []) {
          if (!row.vendedor_id) continue
          if (!porVendedor.has(row.vendedor_id)) porVendedor.set(row.vendedor_id, new Set())
          porVendedor.get(row.vendedor_id)!.add(row.cliente_id)
        }
        const map = new Map<string, number>()
        porVendedor.forEach((clientes, vid) => map.set(vid, clientes.size))
        return map
      }

      const map = new Map<string, number>()
      for (const row of data ?? []) {
        if (!row.vendedor_id) continue
        const atual = map.get(row.vendedor_id) ?? 0
        map.set(row.vendedor_id, atual + Number(row.valor_total ?? 0))
      }
      return map
    },
  })
}

/** Meses com sell-out registrado — base para escolher referência na sugestão top-down. */
export function useMesesComResultado(params: {
  distribuidorId?: string
  tipo?: Meta['tipo']
  enabled?: boolean
}) {
  const { distribuidorId, tipo = 'faturamento', enabled = true } = params
  return useQuery({
    queryKey: [KEY, 'meses-resultado', distribuidorId, tipo],
    enabled:
      enabled &&
      !!distribuidorId &&
      tipo !== 'mix' &&
      tipo !== 'clientes_estrategicos',
    queryFn: async (): Promise<{ mes: string; total: number }[]> => {
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('data_emissao, valor_total, cliente_id')
        .eq('distribuidor_id', distribuidorId!)

      if (error) throw error

      const porMes = new Map<string, { faturamento: number; clientes: Set<string> }>()
      for (const row of data ?? []) {
        const mes = String(row.data_emissao).substring(0, 7)
        if (!porMes.has(mes)) porMes.set(mes, { faturamento: 0, clientes: new Set() })
        const cur = porMes.get(mes)!
        cur.faturamento += Number(row.valor_total ?? 0)
        if (row.cliente_id) cur.clientes.add(row.cliente_id as string)
      }

      return [...porMes.entries()]
        .map(([mes, v]) => ({
          mes,
          total: tipo === 'positivacao' ? v.clientes.size : v.faturamento,
        }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.mes.localeCompare(a.mes))
    },
  })
}

export function useDeleteMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABELA).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidarMetas(qc),
  })
}

/** Meta alterada muda atingimento no Dashboard e nas abas de Performance. */
function invalidarMetas(qc: ReturnType<typeof useQueryClient>) {
  return () => {
    void qc.invalidateQueries({ queryKey: [KEY] })
    void qc.invalidateQueries({ queryKey: ['metas-level'] })
    void qc.invalidateQueries({ queryKey: ['dashboard-kpis'] })
  }
}

/**
 * Realizado de um nó em um período arbitrário — apoio histórico na construção
 * da meta ("quanto essa equipe entregou no mesmo período do ano passado?").
 *
 * Sem `vendedorId` devolve o consolidado do distribuidor. Com `vendedorId`,
 * considera apenas as notas daquele vendedor (venda direta), não da equipe —
 * o consolidado da equipe já é o `valor_realizado` da própria view.
 */
export function useHistoricoParaMeta(params: {
  distribuidorId?: string
  vendedorId?: string | null
  periodoInicio?: string
  periodoFim?: string
  enabled?: boolean
}) {
  const { distribuidorId, vendedorId, periodoInicio, periodoFim, enabled = true } = params
  return useQuery({
    queryKey: [KEY, 'historico', distribuidorId, vendedorId, periodoInicio, periodoFim],
    enabled: enabled && !!distribuidorId && !!periodoInicio && !!periodoFim,
    queryFn: async () => {
      let q = supabase
        .from('alwayson_faturamento')
        .select('valor_total, cliente_id')
        .gte('data_emissao', periodoInicio!)
        .lte('data_emissao', periodoFim!)
        .eq('distribuidor_id', distribuidorId!)

      if (vendedorId) q = q.eq('vendedor_id', vendedorId)

      const { data, error } = await q
      if (error) throw error

      const linhas = (data ?? []) as { valor_total: number; cliente_id: string }[]
      return {
        faturamento: linhas.reduce((s, l) => s + Number(l.valor_total ?? 0), 0),
        clientes: new Set(linhas.map((l) => l.cliente_id)).size,
        notas: linhas.length,
      }
    },
  })
}

/**
 * Metas de um nível ao longo de vários meses — alimenta o panorama em grade.
 *
 * Uma consulta só para toda a janela: a view já devolve o realizado por período,
 * então a grade é apenas outra leitura do mesmo dado que a lista usa.
 */
export function useMetasPanorama(params: {
  distribuidorId?: string
  hierarquia?: Meta['hierarquia']
  tipo?: Meta['tipo']
  mesInicio?: string
  mesFim?: string
}) {
  const { distribuidorId, hierarquia, tipo, mesInicio, mesFim } = params
  return useQuery({
    queryKey: [KEY, 'panorama', distribuidorId, hierarquia, tipo, mesInicio, mesFim],
    enabled: !!distribuidorId && !!hierarquia && !!tipo && !!mesInicio && !!mesFim,
    queryFn: async (): Promise<MetaComNomes[]> => {
      const [{ data, error }, nomes] = await Promise.all([
        supabase
          .from(VIEW)
          .select('*')
          .eq('distribuidor_id', distribuidorId!)
          .eq('hierarquia', hierarquia!)
          .eq('tipo', tipo!)
          .gte('periodo_inicio', `${mesInicio}-01`)
          .lte('periodo_inicio', `${mesFim}-31`)
          .order('periodo_inicio'),
        buscarNomes(),
      ])
      if (error) throw error
      return (data as unknown as MetaAcompanhamento[]).map((m) => enriquecerMeta(m, nomes))
    },
  })
}
