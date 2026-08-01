import { diasEntre, monthEnd, monthStart } from '@/lib/periodo'

export type ClienteFatResumo = {
  ultimaCompra: string | null
  primeiraCompra: string | null
  faturamentoPeriodo: number
  nfsPeriodo: number
  /** Data da compra registrada no período analisado (ex.: NF de 20/05). */
  compraNoPeriodo: string | null
  /** Compra imediatamente anterior à do período (ex.: NF de 10/04). */
  compraAnterior: string | null
  /** Dias entre compraAnterior e compraNoPeriodo (ou fim do período se não comprou). */
  diasSemCompra: number | null
}

export function ticketMedioPeriodo(resumo: ClienteFatResumo): number | null {
  if (resumo.nfsPeriodo <= 0) return null
  return resumo.faturamentoPeriodo / resumo.nfsPeriodo
}

export function emptyClienteFatResumo(): ClienteFatResumo {
  return {
    ultimaCompra: null,
    primeiraCompra: null,
    faturamentoPeriodo: 0,
    nfsPeriodo: 0,
    compraNoPeriodo: null,
    compraAnterior: null,
    diasSemCompra: null,
  }
}

/**
 * Intervalo sem compra: da NF anterior até a venda no mês analisado.
 * Ex.: comprou 10/04 e voltou 20/05 → 40 dias.
 * Se não comprou no mês, mede da última NF até o fim do período.
 * Sem período definido, usa as duas últimas compras do histórico.
 */
export function computeIntervaloSemCompra(
  datasEmissao: string[],
  periodoInicio?: string,
  periodoFim?: string
): Pick<ClienteFatResumo, 'compraNoPeriodo' | 'compraAnterior' | 'diasSemCompra'> {
  if (datasEmissao.length === 0) {
    return { compraNoPeriodo: null, compraAnterior: null, diasSemCompra: null }
  }

  const sorted = [...new Set(datasEmissao)].sort()

  if (periodoInicio && periodoFim) {
    const start = monthStart(periodoInicio)
    const end = monthEnd(periodoFim)
    const noPeriodo = sorted.filter((d) => d >= start && d <= end)

    if (noPeriodo.length > 0) {
      const compraNoPeriodo = noPeriodo[noPeriodo.length - 1]
      const anteriores = sorted.filter((d) => d < compraNoPeriodo)
      const compraAnterior = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null
      if (!compraAnterior) {
        return { compraNoPeriodo, compraAnterior: null, diasSemCompra: null }
      }
      return {
        compraNoPeriodo,
        compraAnterior,
        diasSemCompra: diasEntre(compraAnterior, compraNoPeriodo),
      }
    }

    const anteriores = sorted.filter((d) => d < start)
    if (anteriores.length === 0) {
      return { compraNoPeriodo: null, compraAnterior: null, diasSemCompra: null }
    }
    const compraAnterior = anteriores[anteriores.length - 1]
    return {
      compraNoPeriodo: null,
      compraAnterior,
      diasSemCompra: diasEntre(compraAnterior, end),
    }
  }

  if (sorted.length < 2) {
    return {
      compraNoPeriodo: sorted[sorted.length - 1],
      compraAnterior: null,
      diasSemCompra: null,
    }
  }

  const compraNoPeriodo = sorted[sorted.length - 1]
  const compraAnterior = sorted[sorted.length - 2]
  return {
    compraNoPeriodo,
    compraAnterior,
    diasSemCompra: diasEntre(compraAnterior, compraNoPeriodo),
  }
}

export function buildClienteFatResumoFromFaturamentos(
  faturamentos: { data_emissao: string; valor_total?: number }[],
  periodoMes?: string
): ClienteFatResumo {
  const periodoInicio = periodoMes
  const periodoFim = periodoMes
  const periodoRows =
    periodoMes != null
      ? faturamentos.filter(
          (f) =>
            f.data_emissao >= monthStart(periodoMes) &&
            f.data_emissao <= monthEnd(periodoMes)
        )
      : faturamentos

  const datas = faturamentos.map((f) => f.data_emissao)
  const intervalo = computeIntervaloSemCompra(datas, periodoInicio, periodoFim)

  let primeiraCompra: string | null = null
  for (const f of faturamentos) {
    if (!primeiraCompra || f.data_emissao < primeiraCompra) {
      primeiraCompra = f.data_emissao
    }
  }

  return {
    ultimaCompra: ultimaCompraFromFaturamentos(faturamentos),
    primeiraCompra,
    faturamentoPeriodo: periodoRows.reduce((sum, f) => sum + (f.valor_total ?? 0), 0),
    nfsPeriodo: periodoRows.length,
    ...intervalo,
  }
}

export function ultimaCompraFromFaturamentos(
  faturamentos: { data_emissao: string }[] | undefined | null
): string | null {
  if (!faturamentos?.length) return null
  let max = faturamentos[0].data_emissao
  for (const f of faturamentos) {
    if (f.data_emissao > max) max = f.data_emissao
  }
  return max
}

export function mergeClienteFatResumo(
  clienteIds: string[],
  periodoRows: { cliente_id: string; data_emissao: string; valor_total: number }[],
  allTimeRows: { cliente_id: string; data_emissao: string }[],
  periodoInicio?: string,
  periodoFim?: string
): Map<string, ClienteFatResumo> {
  const map = new Map<string, ClienteFatResumo>()
  const datasByCliente = new Map<string, string[]>()

  for (const id of clienteIds) {
    map.set(id, emptyClienteFatResumo())
    datasByCliente.set(id, [])
  }

  for (const row of periodoRows) {
    const r = map.get(row.cliente_id)
    if (!r) continue
    r.faturamentoPeriodo += Number(row.valor_total)
    r.nfsPeriodo += 1
  }

  for (const row of allTimeRows) {
    const r = map.get(row.cliente_id)
    if (!r) continue
    datasByCliente.get(row.cliente_id)?.push(row.data_emissao)
    if (!r.primeiraCompra || row.data_emissao < r.primeiraCompra) {
      r.primeiraCompra = row.data_emissao
    }
    if (!r.ultimaCompra || row.data_emissao > r.ultimaCompra) {
      r.ultimaCompra = row.data_emissao
    }
  }

  for (const id of clienteIds) {
    const r = map.get(id)
    if (!r) continue
    const intervalo = computeIntervaloSemCompra(
      datasByCliente.get(id) ?? [],
      periodoInicio,
      periodoFim
    )
    r.compraNoPeriodo = intervalo.compraNoPeriodo
    r.compraAnterior = intervalo.compraAnterior
    r.diasSemCompra = intervalo.diasSemCompra
  }

  return map
}

export function topCompradorIds(
  map: Map<string, ClienteFatResumo>,
  topFraction = 0.1
): Set<string> {
  const ranked = [...map.entries()]
    .filter(([, r]) => r.faturamentoPeriodo > 0)
    .sort((a, b) => b[1].faturamentoPeriodo - a[1].faturamentoPeriodo)
  if (ranked.length === 0) return new Set()
  const count = Math.max(1, Math.ceil(ranked.length * topFraction))
  return new Set(ranked.slice(0, count).map(([id]) => id))
}
