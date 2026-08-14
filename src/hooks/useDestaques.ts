import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { calcularJanela, calcularComparacao } from '@/lib/janela-periodo'

/**
 * Destaques automáticos do Início — maiores altas e quedas por distribuidor e
 * por produto, comparando o ano vigente com o mesmo período do ano anterior.
 *
 * Os números vêm das views mensais agregadas (067/070) — nada é somado no
 * cliente sobre nota a nota.
 */

export type DestaqueTipo = 'distribuidor' | 'produto'

export interface Destaque {
  tipo: DestaqueTipo
  chave: string
  rotulo: string
  atual: number
  anterior: number
  variacaoPercentual: number
}

export interface Destaques {
  altas: Destaque[]
  quedas: Destaque[]
}

function dentroDe(mes: string, janela: { inicio: string; fim: string }): boolean {
  return mes >= `${janela.inicio}-01` && mes <= `${janela.fim}-01`
}

export function useDestaques() {
  return useQuery({
    queryKey: ['destaques'],
    queryFn: async (): Promise<Destaques> => {
      const base = calcularJanela('ano_vigente')
      const comp = calcularComparacao(base, 'ano_anterior')
      if (!comp) return { altas: [], quedas: [] }

      const [distRes, prodRes, nomeRes] = await Promise.all([
        supabase
          .from('alwayson_faturamento_v_mensal')
          .select('distribuidor_id, mes, faturamento')
          .eq('eh_total_distribuidor', true)
          .gte('mes', `${comp.inicio}-01`)
          .lte('mes', `${base.fim}-01`),
        supabase
          .from('alwayson_faturamento_v_mensal_produto')
          .select('sku, nome_produto, mes, faturamento')
          .gte('mes', `${comp.inicio}-01`)
          .lte('mes', `${base.fim}-01`),
        supabase.from('alwayson_distribuidores').select('id, nome'),
      ])
      if (distRes.error) throw distRes.error
      if (prodRes.error) throw prodRes.error
      if (nomeRes.error) throw nomeRes.error

      const nomePorId = new Map(
        (nomeRes.data ?? []).map((d) => [d.id as string, d.nome as string])
      )

      const porChave = new Map<
        string,
        { tipo: DestaqueTipo; rotulo: string; atual: number; anterior: number }
      >()

      for (const r of distRes.data ?? []) {
        const chave = r.distribuidor_id as string
        const valor = Number(r.faturamento ?? 0)
        const v = porChave.get(chave) ?? {
          tipo: 'distribuidor' as const,
          rotulo: nomePorId.get(chave) ?? '—',
          atual: 0,
          anterior: 0,
        }
        if (dentroDe(String(r.mes), base)) v.atual += valor
        else v.anterior += valor
        porChave.set(chave, v)
      }

      for (const r of prodRes.data ?? []) {
        const chave = r.sku as string
        const valor = Number(r.faturamento ?? 0)
        const v = porChave.get(chave) ?? {
          tipo: 'produto' as const,
          rotulo: String(r.nome_produto ?? r.sku),
          atual: 0,
          anterior: 0,
        }
        if (dentroDe(String(r.mes), base)) v.atual += valor
        else v.anterior += valor
        porChave.set(chave, v)
      }

      const destaque: Destaque[] = []
      for (const [chave, v] of porChave) {
        // Sem base anterior não há variação defensável — só ruído.
        if (v.anterior <= 0) continue
        destaque.push({
          tipo: v.tipo,
          chave,
          rotulo: v.rotulo,
          atual: v.atual,
          anterior: v.anterior,
          variacaoPercentual: ((v.atual - v.anterior) / v.anterior) * 100,
        })
      }

      const porVariacao = [...destaque].sort((a, b) => b.variacaoPercentual - a.variacaoPercentual)
      return {
        altas: porVariacao.slice(0, 4),
        quedas: [...porVariacao].reverse().slice(0, 4),
      }
    },
  })
}
