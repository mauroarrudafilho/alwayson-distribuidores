import type { InsightsClienteMes, InsightsTopCliente, InsightsClienteMixRow } from '@/types/insights'
import type { ClientTagCategory } from '@/components/distribuidor/ClientTag'
import type { MixCorrelacaoResumo } from '@/lib/insights-mix-correlacao'

export type InsightsSinalizador = {
  id: string
  label: string
  category: ClientTagCategory
  title?: string
}

export function buildInsightsSinalizadores(
  cliente: InsightsTopCliente,
  historico: InsightsClienteMes[],
  mix: InsightsClienteMixRow[],
  correlacao?: MixCorrelacaoResumo
): InsightsSinalizador[] {
  const tags: InsightsSinalizador[] = []

  if (historico.length >= 18) {
    tags.push({
      id: 'historico_longo',
      label: `${historico.length}m histórico`,
      category: 'segmento',
      title: 'Base histórica extensa no Insights',
    })
  }

  if (cliente.total_skus >= 15 || mix.length >= 15) {
    tags.push({
      id: 'mix_amplo',
      label: 'Mix amplo',
      category: 'programa',
      title: 'Amplitude de SKUs acima da média na base histórica',
    })
  }

  const mediaNfs =
    historico.length > 0
      ? historico.reduce((s, h) => s + h.total_nfs, 0) / historico.length
      : 0
  if (mediaNfs >= 2) {
    tags.push({
      id: 'alta_recorrencia',
      label: 'Alta recorrência',
      category: 'destaque',
      title: 'Média de NFs por mês elevada no histórico',
    })
  }

  if (cliente.faturamento_total >= 500_000) {
    tags.push({
      id: 'top_historico',
      label: 'Top histórico',
      category: 'destaque',
      title: 'Faturamento histórico consolidado elevado',
    })
  }

  if (correlacao && correlacao.soHistorico >= 3) {
    tags.push({
      id: 'oportunidade_mix',
      label: `${correlacao.soHistorico} SKUs p/ reativar`,
      category: 'flag',
      title: 'Produtos do histórico ainda não vendidos pelo distribuidor atual',
    })
  }

  if (correlacao && correlacao.soLocal >= 2 && correlacao.continuidade > 0) {
    tags.push({
      id: 'mix_evolutivo',
      label: 'Mix evolutivo',
      category: 'fonte',
      title: 'Mix atual complementa o histórico com itens novos',
    })
  }

  return tags
}

export function formatAnoMesLabel(anoMes: string): string {
  const [year, month] = anoMes.split('-')
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[Number(month) - 1]}/${year.slice(2)}`
}

export function historicoResumo(historico: InsightsClienteMes[]) {
  if (historico.length === 0) {
    return { total: 0, media: 0, pico: null as InsightsClienteMes | null, primeiro: null, ultimo: null }
  }
  const total = historico.reduce((s, h) => s + h.faturamento, 0)
  const media = total / historico.length
  const pico = historico.reduce((best, h) => (h.faturamento > best.faturamento ? h : best), historico[0])
  return {
    total,
    media,
    pico,
    primeiro: historico[0],
    ultimo: historico[historico.length - 1],
  }
}
