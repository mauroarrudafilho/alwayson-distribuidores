import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadPdfReport } from '@/lib/exportPdfReport'
import { useOnePager } from '@/hooks/useOnePager'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { formatAnoMesLabel } from '@/lib/insights-sinalizadores'
import { getCurrentMonth } from '@/lib/periodo'
import type { Distribuidor } from '@/types/distribuidor'

const TIPO_LABEL: Record<string, string> = {
  vendas: 'Vendas',
  clientes: 'Clientes',
  estoque: 'Estoque',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  processando: 'Processando',
  concluido: 'Concluído',
  erro: 'Erro',
}

const HIERARQUIA_LABEL: Record<string, string> = {
  distribuidor: 'Distribuidor',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
}

/**
 * One-pager mensal exportável (Pacote C.4) — o relatório do KAM para a reunião
 * com o distribuidor: faturamento, metas, top produtos, quedas, evolução e
 * saúde do dado. Ações pendentes entram quando o Pacote C (plano de ação)
 * existir.
 */
export function OnePagerExport({ distribuidor }: { distribuidor: Distribuidor }) {
  const [mes, setMes] = useState<string>(getCurrentMonth())
  const { data, isLoading } = useOnePager(distribuidor.id, mes)

  function exportar() {
    if (!data) return

    const metaDistribuidor = data.metas.find((m) => m.hierarquia === 'distribuidor')
    const variacao =
      data.faturamentoMesAnterior > 0
        ? ((data.faturamentoMes - data.faturamentoMesAnterior) / data.faturamentoMesAnterior) * 100
        : null

    const pct = (valor: number | null): string =>
      valor == null ? '—' : `${valor.toFixed(1).replace('.', ',')}%`

    const sections: NonNullable<Parameters<typeof downloadPdfReport>[0]>['sections'] = [
      {
        title: 'Metas do mês (faturamento)',
        head: ['Nível', 'Meta R$', 'Realizado R$', 'Atingimento'],
        body: data.metas.map((m) => [
          HIERARQUIA_LABEL[m.hierarquia] ?? m.hierarquia,
          formatCurrency(m.valor_meta),
          m.valor_realizado == null ? '—' : formatCurrency(m.valor_realizado),
          pct(m.percentual_atingimento),
        ]),
      },
      {
        title: 'Top produtos do mês',
        head: ['SKU', 'Produto', 'Faturamento R$', 'Var. vs mês anterior'],
        body: data.topProdutos.map((p) => [
          p.sku,
          p.nome,
          formatCurrency(p.atual),
          p.variacao == null ? '—' : pct(p.variacao),
        ]),
      },
      {
        title: 'Quedas vs mês anterior',
        head: ['SKU', 'Produto', 'Mês atual R$', 'Mês anterior R$', 'Queda'],
        body: data.quedasProdutos.map((p) => [
          p.sku,
          p.nome,
          formatCurrency(p.atual),
          formatCurrency(p.anterior),
          pct(p.variacao),
        ]),
      },
      {
        title: 'Evolução mensal',
        head: ['Mês', 'Faturamento R$', 'Positivados'],
        body: data.evolucaoMensal.map((m) => [
          formatAnoMesLabel(m.mes),
          formatCurrency(m.faturamento),
          String(m.clientes_positivados),
        ]),
      },
      {
        title: 'Saúde do dado',
        head: ['Tipo', 'Referência', 'Status', 'Recebido em'],
        body: data.relatorios.map((r) => [
          TIPO_LABEL[r.tipo] ?? r.tipo,
          r.periodo_referencia ? formatAnoMesLabel(String(r.periodo_referencia).slice(0, 7)) : '—',
          STATUS_LABEL[r.status] ?? r.status,
          r.criado_em ? formatDateTime(r.criado_em) : '—',
        ]),
      },
    ]

    downloadPdfReport({
      filename: `one-pager-${distribuidor.nome.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      title: 'One-pager mensal · Reunião KAM',
      subtitle: distribuidor.nome,
      meta: [
        { label: 'CNPJ', value: distribuidor.cnpj },
        { label: 'Local', value: `${distribuidor.cidade}/${distribuidor.estado}` },
        { label: 'Responsável', value: distribuidor.responsavel || '—' },
        { label: 'Mês de referência', value: formatAnoMesLabel(data.mes) },
        { label: 'Faturamento', value: formatCurrency(data.faturamentoMes) },
        {
          label: 'Variação vs mês anterior',
          value: variacao == null ? '—' : `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}%`,
        },
        {
          label: 'Meta do mês',
          value: metaDistribuidor ? formatCurrency(metaDistribuidor.valor_meta) : '—',
        },
        {
          label: 'Atingimento',
          value: pct(metaDistribuidor?.percentual_atingimento ?? null),
        },
        { label: 'Positivados', value: String(data.clientesPositivados) },
        { label: 'SKUs no mês', value: String(data.skusDistintos) },
      ],
      sections,
      footer: 'Fonte: Mesh — sell-in ingerido. Realizado derivado do faturamento; comparações com o mesmo período de referência.',
    })
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-foreground">One-pager mensal (PDF)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Relatório do KAM para a reunião com o distribuidor: faturamento, metas, top produtos,
          quedas, evolução e saúde do dado.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-9 w-[180px] text-sm"
            aria-label="Mês de referência do one-pager"
          />
          <Button onClick={exportar} disabled={isLoading || !data} size="sm">
            <FileDown className="h-4 w-4" />
            {isLoading ? 'Carregando…' : 'Exportar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
