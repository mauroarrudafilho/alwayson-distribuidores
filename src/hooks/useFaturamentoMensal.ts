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
 *
 * ⚠️ Divisor crítico: deve ser o número de MESES DISTINTOS, não `rows.length`.
 * Motivo: `eh_total_distribuidor` colassa apenas `vendedor_id`, não distribuidor/fornecedor.
 * Sem filtro de distribuidor (estado padrão "Todos"), a query retorna uma linha por
 * (distribuidor × fornecedor × mês). Com N distribuidores e M fornecedores, temos
 * N×M linhas por mês, não 1. Dividir pela contagem de linhas inflaria o denominador
 * e subestimaria o cliente médio por mês. Agrupamos por mês, somamos clientes_positivados
 * por mês, e dividimos pelo número de meses.
 *
 * Limitação aceitável: dentro de um mês, as contagens distintas são somadas entre
 * distribuidores — um CNPJ atendido por dois parceiros conta como 2. Defensável como
 * "duas relações comerciais", e sem efeito observável enquanto há um distribuidor.
 */
export function resumirPeriodo(rows: FaturamentoMensalRow[]): ResumoPeriodo {
  const faturamento = rows.reduce((s, r) => s + r.faturamento, 0)
  const nfs = rows.reduce((s, r) => s + r.nfs, 0)

  const porMes = new Map<string, number>()
  for (const r of rows) {
    porMes.set(r.mes, (porMes.get(r.mes) ?? 0) + r.clientes_positivados)
  }
  const clientes = porMes.size
    ? Math.round([...porMes.values()].reduce((s, v) => s + v, 0) / porMes.size)
    : 0

  return {
    faturamento,
    nfs,
    clientes,
    ticketMedio: nfs > 0 ? faturamento / nfs : 0,
  }
}
