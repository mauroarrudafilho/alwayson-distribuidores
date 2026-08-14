import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { getCurrentMonth } from '@/lib/periodo'

/** Tipos de relatório que o template de ingestão conhece. */
export const TIPOS_RELATORIO = ['vendas', 'clientes', 'estoque'] as const
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]

export interface SaudeDadoDistribuidor {
  distribuidor_id: string
  distribuidor_nome: string
  /** Tipos com relatório referente ao mês corrente. */
  tiposNoMes: Set<TipoRelatorio>
  /** Data ISO da chegada mais recente de qualquer relatório. */
  ultimaChegada: string | null
}

/**
 * Saúde do dado do Início (Pacote A): por distribuidor, quais templates do mês
 * corrente entraram e qual a última chegada. Alimenta o "quem está sem enviar".
 */
export function useSaudeDado() {
  return useQuery({
    queryKey: ['saude-dado'],
    queryFn: async (): Promise<SaudeDadoDistribuidor[]> => {
      const mes = getCurrentMonth()

      const [relRes, distRes] = await Promise.all([
        supabase
          .from('alwayson_relatorios_ingestao')
          .select('distribuidor_id, tipo, periodo_referencia, criado_em')
          .order('criado_em', { ascending: false })
          .limit(500),
        supabase.from('alwayson_distribuidores').select('id, nome').eq('status', 'ativo'),
      ])
      if (relRes.error) throw relRes.error
      if (distRes.error) throw distRes.error

      const vistos = new Set<string>()
      const porDistribuidor = new Map<string, SaudeDadoDistribuidor>()

      const tocar = (id: string, nome: string) => {
        let d = porDistribuidor.get(id)
        if (!d) {
          d = {
            distribuidor_id: id,
            distribuidor_nome: nome,
            tiposNoMes: new Set<TipoRelatorio>(),
            ultimaChegada: null,
          }
          porDistribuidor.set(id, d)
        }
        return d
      }

      for (const r of relRes.data ?? []) {
        const id = r.distribuidor_id as string
        const nome = '—'
        const d = tocar(id, nome)

        // Ordenado desc, a primeira visita é a chegada mais recente.
        if (!vistos.has(id)) {
          vistos.add(id)
          d.ultimaChegada = (r.criado_em as string) ?? null
        }

        // `periodo_referencia` é data de fim de período (ex.: 2026-08-31) —
        // compara só o mês civil para saber se entrou relatório do mês corrente.
        if (String(r.periodo_referencia).slice(0, 7) === mes) {
          const tipo = r.tipo as TipoRelatorio
          if (TIPOS_RELATORIO.includes(tipo)) d.tiposNoMes.add(tipo)
        }
      }

      // Distribuidores sem nenhum relatório entram zerados — o "✗ em tudo" é dado.
      const rows: SaudeDadoDistribuidor[] = []
      for (const d of distRes.data ?? []) {
        const id = d.id as string
        const existente = porDistribuidor.get(id)
        if (existente) {
          existente.distribuidor_nome = d.nome as string
          rows.push(existente)
        } else {
          rows.push({
            distribuidor_id: id,
            distribuidor_nome: d.nome as string,
            tiposNoMes: new Set<TipoRelatorio>(),
            ultimaChegada: null,
          })
        }
      }

      return rows.sort((a, b) => a.distribuidor_nome.localeCompare(b.distribuidor_nome))
    },
  })
}
