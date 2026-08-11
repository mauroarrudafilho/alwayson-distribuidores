import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'

export type NivelHierarquia = 'gerente' | 'supervisor' | 'vendedor'

export interface SerieEntidade {
  /** Um item por mês da janela, na ordem de `janela.meses`. 0 = sem faturamento. */
  valores: number[]
  total: number
}

type LinhaSerie = { chave: string; mes: string; faturamento: number }

/**
 * Monta o Map de séries a partir de linhas cruas.
 *
 * O preenchimento com 0 é deliberado e diferente do gráfico grande: ali um mês
 * sem contraparte é `null` para a linha interromper. Aqui, dentro da janela
 * escolhida, um mês sem faturamento é uma informação real — o vendedor não
 * vendeu — e a minissérie deve mostrar o vale, não um buraco.
 */
function montarSeries(linhas: LinhaSerie[], janela: Janela): Map<string, SerieEntidade> {
  const indicePorMes = new Map(janela.meses.map((m, i) => [m, i]))
  const out = new Map<string, SerieEntidade>()

  for (const l of linhas) {
    const mesChave = l.mes.slice(0, 7)
    const i = indicePorMes.get(mesChave)
    if (i === undefined) continue

    let serie = out.get(l.chave)
    if (!serie) {
      serie = { valores: new Array(janela.meses.length).fill(0), total: 0 }
      out.set(l.chave, serie)
    }
    serie.valores[i] += l.faturamento
    serie.total += l.faturamento
  }
  return out
}

const PAGE = 1000

/** Pagina uma view de série; sem isto o Supabase corta em 1000 linhas em silêncio. */
async function carregarPaginado(
  tabela: string,
  colunaChave: string,
  janela: Janela,
  distribuidorId: string | undefined,
  filtroExtra?: { coluna: string; valor: string }
): Promise<LinhaSerie[]> {
  const all: LinhaSerie[] = []
  let from = 0
  // Coluna montada em runtime: string explícita evita que o supabase-js tente
  // resolver as colunas via literal type e falhe com ParserError no tsc.
  const colunasSelect: string = `${colunaChave}, mes, faturamento`
  for (;;) {
    let q = supabase
      .from(tabela)
      .select(colunasSelect)
      .gte('mes', `${janela.inicio}-01`)
      .lte('mes', `${janela.fim}-01`)
      .range(from, from + PAGE - 1)

    if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)
    if (filtroExtra) q = q.eq(filtroExtra.coluna, filtroExtra.valor)

    const { data, error } = await q
    if (error) throw error
    const chunk = data ?? []
    for (const row of chunk) {
      const r = row as unknown as Record<string, unknown>
      all.push({
        chave: String(r[colunaChave]),
        mes: String(r.mes),
        faturamento: Number(r.faturamento),
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

export function useSerieHierarquia(
  distribuidorId: string | undefined,
  nivel: NivelHierarquia,
  janela: Janela
) {
  return useQuery({
    queryKey: ['serie-hierarquia', distribuidorId ?? 'all', nivel, janela.inicio, janela.fim],
    queryFn: async () => {
      const linhas = await carregarPaginado(
        'alwayson_faturamento_v_mensal_hierarquia',
        'entidade_id',
        janela,
        distribuidorId,
        { coluna: 'nivel', valor: nivel }
      )
      return montarSeries(linhas, janela)
    },
  })
}

export function useSerieCliente(distribuidorId: string | undefined, janela: Janela) {
  return useQuery({
    queryKey: ['serie-cliente', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: async () => {
      const linhas = await carregarPaginado(
        'alwayson_faturamento_v_mensal_cliente',
        'cliente_id',
        janela,
        distribuidorId
      )
      return montarSeries(linhas, janela)
    },
  })
}
