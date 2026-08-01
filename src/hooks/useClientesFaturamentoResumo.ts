import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthEnd, monthStart } from '@/lib/periodo'
import { useFaturamentoSales } from '@/hooks/useFaturamentoPerformance'
import {
  emptyClienteFatResumo,
  mergeClienteFatResumo,
  topCompradorIds,
  type ClienteFatResumo,
} from '@/lib/cliente-faturamento-resumo'

const PAGE = 1000

async function fetchClienteFatDates(
  distribuidorId: string,
  clienteIds: string[]
): Promise<{ cliente_id: string; data_emissao: string }[]> {
  if (clienteIds.length === 0) return []

  const all: { cliente_id: string; data_emissao: string }[] = []
  for (let i = 0; i < clienteIds.length; i += 150) {
    const slice = clienteIds.slice(i, i + 150)
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('alwayson_faturamento')
        .select('cliente_id, data_emissao')
        .eq('distribuidor_id', distribuidorId)
        .in('cliente_id', slice)
        .order('data_emissao', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const chunk = (data ?? []) as { cliente_id: string; data_emissao: string }[]
      all.push(...chunk)
      if (chunk.length < PAGE) break
      from += PAGE
    }
  }
  return all
}

export function useClientesFaturamentoResumo(
  distribuidorId: string | undefined,
  clienteIds: string[],
  periodoInicio?: string,
  periodoFim?: string
) {
  const idsKey = useMemo(() => [...clienteIds].sort().join(','), [clienteIds])

  const { data: sales = [], isLoading: loadingPeriodo } = useFaturamentoSales(
    distribuidorId,
    periodoInicio,
    periodoFim
  )

  const { data: allTimeRows = [], isLoading: loadingAllTime } = useQuery({
    queryKey: ['clientes-fat-datas', distribuidorId, idsKey],
    enabled: !!distribuidorId && clienteIds.length > 0,
    queryFn: () => fetchClienteFatDates(distribuidorId!, clienteIds),
  })

  const resumoMap = useMemo(() => {
    if (clienteIds.length === 0) return new Map<string, ClienteFatResumo>()

    const periodoRows = sales
      .filter((s) => clienteIds.includes(s.cliente_id))
      .filter((s) => {
        if (!periodoInicio && !periodoFim) return true
        const d = s.data_emissao
        if (periodoInicio && d < monthStart(periodoInicio)) return false
        if (periodoFim && d > monthEnd(periodoFim)) return false
        return true
      })
      .map((s) => ({
        cliente_id: s.cliente_id,
        data_emissao: s.data_emissao,
        valor_total: s.valor_total,
      }))

    return mergeClienteFatResumo(
      clienteIds,
      periodoRows,
      allTimeRows,
      periodoInicio,
      periodoFim
    )
  }, [clienteIds, sales, allTimeRows, periodoInicio, periodoFim])

  const topIds = useMemo(() => topCompradorIds(resumoMap), [resumoMap])

  return {
    resumoMap,
    topIds,
    isLoading: loadingPeriodo || loadingAllTime,
    getResumo: (clienteId: string) => resumoMap.get(clienteId) ?? emptyClienteFatResumo(),
  }
}
