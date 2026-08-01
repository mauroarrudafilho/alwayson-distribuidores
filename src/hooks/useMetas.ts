import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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
}

const KEY = 'metas' as const
const VIEW = 'alwayson_metas_v_acompanhamento'
const TABELA = 'alwayson_metas_distribuidor'

/**
 * Nomes resolvidos por query separada em vez de embed do PostgREST: o embed a
 * partir de uma *view* depende de inferência de relacionamento e quebraria a
 * tela se falhasse. As duas tabelas são pequenas (1 distribuidor, 64 vendedores).
 */
async function buscarNomes() {
  const [dist, vend] = await Promise.all([
    supabase.from('alwayson_distribuidores').select('id, nome'),
    supabase.from('alwayson_vendedores_distribuidor').select('id, nome'),
  ])
  if (dist.error) throw dist.error
  if (vend.error) throw vend.error
  return {
    distribuidores: new Map((dist.data ?? []).map((d) => [d.id as string, d.nome as string])),
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
      return (data as unknown as MetaAcompanhamento[]).map((m) => ({
        ...m,
        distribuidor_nome: nomes.distribuidores.get(m.distribuidor_id) ?? '—',
        vendedor_nome: m.vendedor_id ? (nomes.vendedores.get(m.vendedor_id) ?? '—') : null,
      }))
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
      const userId = userResp.user?.id ?? null

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
    },
    onSuccess: invalidarMetas(qc),
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
