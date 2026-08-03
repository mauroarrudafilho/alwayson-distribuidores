import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ClienteDistribuidor } from '@/types/distribuidor'

const PAGE_SIZE_FETCH = 1000
const GEO_VIEW = 'alwayson_v_clientes_distribuidor_geo'

type StatsRow = { estado_exibicao: string | null; distribuidor_id: string | null }

function estadoValido(estado: string | null | undefined): string {
  const e = String(estado ?? '').trim()
  if (!e || e === '—' || e === '-') return ''
  return e
}

function applySearchFilters<T extends { or: Function; eq: Function }>(
  query: T,
  search: string,
  ufFilter: string
): T {
  let q = query
  if (search.length > 0) {
    const term = `%${search}%`
    q = q.or(
      `cnpj.ilike.${term},razao_social.ilike.${term},nome_fantasia.ilike.${term}`
    ) as T
  }
  if (ufFilter) {
    q = q.eq('estado_exibicao', ufFilter) as T
  }
  return q
}

async function fetchAllStatsRows(search: string, ufFilter: string): Promise<StatsRow[]> {
  const rows: StatsRow[] = []
  for (let from = 0; ; from += PAGE_SIZE_FETCH) {
    const { data, error } = await applySearchFilters(
      supabase.from(GEO_VIEW).select('estado_exibicao, distribuidor_id'),
      search,
      ufFilter
    ).range(from, from + PAGE_SIZE_FETCH - 1)
    if (error) throw error
    const chunk = (data ?? []) as StatsRow[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE_FETCH) break
  }
  return rows
}

async function fetchUfOptions(search: string): Promise<string[]> {
  const rows: StatsRow[] = []
  for (let from = 0; ; from += PAGE_SIZE_FETCH) {
    const { data, error } = await applySearchFilters(
      supabase.from(GEO_VIEW).select('estado_exibicao'),
      search,
      ''
    ).range(from, from + PAGE_SIZE_FETCH - 1)
    if (error) throw error
    const chunk = (data ?? []) as StatsRow[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE_FETCH) break
  }
  return [...new Set(rows.map((r) => estadoValido(r.estado_exibicao)).filter(Boolean))].sort()
}

export type ClientesBuscaResult = {
  rows: ClienteDistribuidor[]
  total: number
  kpi: {
    clientes: number
    ufs: number
    distribuidores: number
  }
  ufOptions: string[]
}

export function useClientesBusca(
  search: string,
  ufFilter: string,
  page: number,
  pageSize: number
) {
  return useQuery({
    queryKey: ['clientes-busca', search, ufFilter, page, pageSize],
    queryFn: async (): Promise<ClientesBuscaResult> => {
      const [statsRows, ufOptions] = await Promise.all([
        fetchAllStatsRows(search, ufFilter),
        fetchUfOptions(search),
      ])

      const total = statsRows.length
      const ufs = new Set(statsRows.map((r) => estadoValido(r.estado_exibicao)).filter(Boolean))
      const distribuidores = new Set(
        statsRows.map((r) => r.distribuidor_id).filter(Boolean)
      )

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error } = await applySearchFilters(
        supabase.from(GEO_VIEW).select('*'),
        search,
        ufFilter
      )
        .order('razao_social')
        .range(from, to)

      if (error) throw error

      const rows = ((data ?? []) as Array<
        ClienteDistribuidor & {
          cidade_exibicao?: string | null
          estado_exibicao?: string | null
        }
      >).map((row) => {
        const { cidade_exibicao, estado_exibicao, ...rest } = row
        return {
          ...rest,
          cidade: cidade_exibicao ?? rest.cidade,
          estado: estado_exibicao ?? rest.estado,
        } satisfies ClienteDistribuidor
      })

      return {
        rows,
        total,
        kpi: {
          clientes: total,
          ufs: ufs.size,
          distribuidores: distribuidores.size,
        },
        ufOptions,
      }
    },
  })
}
