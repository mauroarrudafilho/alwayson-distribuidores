import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthStart, monthEnd, getCurrentMonth } from '@/lib/periodo'
import { diasUteisNoMes, diasUteisAteHoje } from '@/lib/dias-uteis'

/**
 * Ritmo do mês (pacing): realizado vs meta de faturamento do mês corrente,
 * por distribuidor, com projeção de fechamento no ritmo atual.
 *
 * Usa a meta de nível `distribuidor` (o dono da meta) da view de acompanhamento
 * (migration 045) — nunca toca a tabela, para o realizado vir derivado.
 */
export interface PacingCard {
  distribuidor_id: string
  distribuidor_nome: string
  meta: number
  realizado: number
  percentual_atingimento: number | null
  dias_uteis_totais: number
  dias_uteis_decorridos: number
  dias_uteis_restantes: number
  /** (realizado ÷ dias decorridos) × dias totais — fechamento no ritmo atual. */
  projecao_fechamento: number | null
  /** Projeção ÷ meta. Null sem dias decorridos ou sem meta. */
  percentual_projecao: number | null
  /** (meta − realizado) ÷ dias úteis restantes — o que falta vender por dia útil. */
  valor_dia_util_necessario: number | null
}

export function usePacing() {
  return useQuery({
    queryKey: ['pacing'],
    queryFn: async (): Promise<PacingCard[]> => {
      const mes = getCurrentMonth()
      const [metasRes, distRes] = await Promise.all([
        supabase
          .from('alwayson_metas_v_acompanhamento')
          .select('distribuidor_id, valor_meta, valor_realizado, percentual_atingimento')
          .eq('tipo', 'faturamento')
          .eq('hierarquia', 'distribuidor')
          .eq('periodo_inicio', monthStart(mes))
          .eq('periodo_fim', monthEnd(mes)),
        supabase.from('alwayson_distribuidores').select('id, nome'),
      ])
      if (metasRes.error) throw metasRes.error
      if (distRes.error) throw distRes.error

      const nomePorId = new Map(
        (distRes.data ?? []).map((d) => [d.id as string, d.nome as string])
      )
      const diasTotais = diasUteisNoMes(mes)
      const diasDecorridos = diasUteisAteHoje()
      const diasRestantes = Math.max(diasTotais - diasDecorridos, 0)

      const cards: PacingCard[] = (metasRes.data ?? []).map((m) => {
        const meta = Number(m.valor_meta ?? 0)
        const realizado = Number(m.valor_realizado ?? 0)

        let projecaoFechamento: number | null = null
        let percentualProjecao: number | null = null
        if (diasDecorridos > 0 && meta > 0) {
          projecaoFechamento = (realizado / diasDecorridos) * diasTotais
          percentualProjecao = (projecaoFechamento / meta) * 100
        }

        let valorDiaUtil: number | null = null
        if (diasRestantes > 0 && meta > 0) {
          valorDiaUtil = (meta - realizado) / diasRestantes
        }

        return {
          distribuidor_id: m.distribuidor_id as string,
          distribuidor_nome: nomePorId.get(m.distribuidor_id as string) ?? '—',
          meta,
          realizado,
          percentual_atingimento:
            m.percentual_atingimento == null
              ? null
              : Number(m.percentual_atingimento),
          dias_uteis_totais: diasTotais,
          dias_uteis_decorridos: diasDecorridos,
          dias_uteis_restantes: diasRestantes,
          projecao_fechamento: projecaoFechamento,
          percentual_projecao: percentualProjecao,
          valor_dia_util_necessario: valorDiaUtil,
        }
      })

      // Mais atrasado primeiro — o Início deve mostrar onde apertar.
      return cards.sort(
        (a, b) =>
          (a.percentual_projecao ?? Number.MAX_VALUE) -
          (b.percentual_projecao ?? Number.MAX_VALUE)
      )
    },
  })
}
