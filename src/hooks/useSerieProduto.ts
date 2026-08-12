import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Janela } from '@/lib/janela-periodo'
import type { SerieEntidade } from '@/hooks/useSerieEntidade'

export interface LinhaSerieProduto {
  sku: string
  nomeProduto: string
  vendedorId: string | null
  mes: string
  faturamento: number
}

const PAGE = 1000

/** Pagina a view mensal por produto; sem isto o Supabase corta em 1000 linhas em silêncio. */
async function carregarProdutoPaginado(
  distribuidorId: string | undefined,
  janela: Janela
): Promise<LinhaSerieProduto[]> {
  const all: LinhaSerieProduto[] = []
  let from = 0
  for (;;) {
    let q = supabase
      .from('alwayson_faturamento_v_mensal_produto')
      .select('sku, nome_produto, vendedor_id, mes, faturamento')
      .gte('mes', `${janela.inicio}-01`)
      .lte('mes', `${janela.fim}-01`)
      .order('sku')
      .order('mes')
      .order('vendedor_id')
      .order('distribuidor_id')
      .range(from, from + PAGE - 1)

    if (distribuidorId) q = q.eq('distribuidor_id', distribuidorId)

    const { data, error } = await q
    if (error) throw error
    const chunk = data ?? []
    for (const row of chunk) {
      const r = row as unknown as Record<string, unknown>
      all.push({
        sku: String(r.sku),
        nomeProduto: String(r.nome_produto),
        vendedorId: r.vendedor_id == null ? null : String(r.vendedor_id),
        mes: String(r.mes),
        faturamento: Number(r.faturamento),
      })
    }
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

export function useSerieProduto(distribuidorId: string | undefined, janela: Janela) {
  return useQuery({
    queryKey: ['serie-produto', distribuidorId ?? 'all', janela.inicio, janela.fim],
    queryFn: () => carregarProdutoPaginado(distribuidorId, janela),
  })
}

/**
 * Agrega linhas cruas em séries por SKU, filtrando por vendedor quando um
 * recorte de hierarquia está ativo. `vendedorIdsPermitidos = null` significa
 * sem filtro (todos os vendedores); um Set vazio significa filtro ativo sem
 * nenhum vendedor elegível (ex.: supervisor sem subordinados) — nesse caso
 * nenhuma linha passa e as séries voltam vazias, de propósito.
 */
export function montarSeriesProduto(
  linhas: LinhaSerieProduto[],
  janela: Janela,
  vendedorIdsPermitidos: Set<string> | null
): { series: Map<string, SerieEntidade>; nomes: Map<string, string> } {
  const indicePorMes = new Map(janela.meses.map((m, i) => [m, i]))
  const series = new Map<string, SerieEntidade>()
  const nomes = new Map<string, string>()

  for (const l of linhas) {
    if (vendedorIdsPermitidos && (!l.vendedorId || !vendedorIdsPermitidos.has(l.vendedorId))) {
      continue
    }
    const mesChave = l.mes.slice(0, 7)
    const i = indicePorMes.get(mesChave)
    if (i === undefined) continue

    let serie = series.get(l.sku)
    if (!serie) {
      serie = { valores: new Array(janela.meses.length).fill(0), total: 0 }
      series.set(l.sku, serie)
    }
    serie.valores[i] += l.faturamento
    serie.total += l.faturamento
    nomes.set(l.sku, l.nomeProduto)
  }

  return { series, nomes }
}
