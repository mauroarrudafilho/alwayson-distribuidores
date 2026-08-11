import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'
import type { FaturamentoMensalRow } from '@/types/faturamento-mensal'

export interface ResumoPeriodo {
  faturamento: number
  nfs: number
  clientes: number
  ticketMedio: number
}

/**
 * Série mensal do período. Lê só as linhas de total do distribuidor — as linhas
 * por vendedor existem na view para a etapa 2 (minisséries por linha).
 */
export function useFaturamentoMensal(
  distribuidorId: string | undefined,
  janela: Janela
) {
  return useQuery({
    queryKey: ['faturamento-mensal', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: async (): Promise<FaturamentoMensalRow[]> => {
      let q = supabase
        .from('alwayson_faturamento_v_mensal')
        .select(
          'distribuidor_id, fornecedor_tenant_id, vendedor_id, eh_total_distribuidor, mes, faturamento, nfs, clientes_positivados, skus_distintos'
        )
        .eq('eh_total_distribuidor', true)
        .gte('mes', `${janela.inicio}-01`)
        .lte('mes', `${janela.fim}-01`)
        .order('mes', { ascending: true })

      if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r) => ({
        ...r,
        faturamento: Number(r.faturamento),
        nfs: Number(r.nfs),
        clientes_positivados: Number(r.clientes_positivados),
        skus_distintos: Number(r.skus_distintos),
      })) as FaturamentoMensalRow[]
    },
  })
}

/**
 * Agrega a janela. Faturamento e NFs somam; `clientes` NÃO — a view entrega
 * distintos por mês, e o mesmo cliente aparece em vários. O valor aqui é
 * "clientes atendidos por mês, em média", e o rótulo na UI tem de dizer isso.
 */
export function resumirPeriodo(rows: FaturamentoMensalRow[]): ResumoPeriodo {
  const faturamento = rows.reduce((s, r) => s + r.faturamento, 0)
  const nfs = rows.reduce((s, r) => s + r.nfs, 0)
  const clientes = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.clientes_positivados, 0) / rows.length)
    : 0
  return {
    faturamento,
    nfs,
    clientes,
    ticketMedio: nfs > 0 ? faturamento / nfs : 0,
  }
}
