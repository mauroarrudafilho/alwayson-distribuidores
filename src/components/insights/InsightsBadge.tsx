import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { useClienteEmInsights } from '@/hooks/useClienteEmInsights'
import { InsightsBateOlhoModal } from '@/components/insights/InsightsBateOlhoModal'
import type { MetricaAnalise } from '@/lib/metrica-analise'

interface Props {
  /** CNPJ do cliente (pode vir com ou sem máscara). */
  cnpj: string | null | undefined
  /** Faturamento do ciclo vivo (sell-out do distribuidor) — opcional. */
  faturamentoLocal?: number | null
  /** Total de NFs do ciclo — opcional. */
  nfsLocais?: number | null
  /** Período do ciclo vivo (ex.: mês de análise na Performance). */
  periodoAnalise?: { inicio?: string; fim?: string }
  distribuidorId?: string
  metrica?: MetricaAnalise
}

export function InsightsBadge({
  cnpj,
  faturamentoLocal,
  nfsLocais,
  periodoAnalise,
  distribuidorId,
  metrica,
}: Props) {
  const [open, setOpen] = useState(false)
  const result = useClienteEmInsights(cnpj)

  if (!result.existe) return null

  const { cliente } = result

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        title="Sell-out Insights disponível"
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning"
      >
        <Lightbulb className="size-3.5" />
      </button>

      <InsightsBateOlhoModal
        open={open}
        onOpenChange={setOpen}
        context="performance"
        cliente={cliente}
        faturamentoLocal={faturamentoLocal}
        nfsLocais={nfsLocais}
        periodoAnalise={periodoAnalise}
        distribuidorId={distribuidorId}
        metrica={metrica}
      />
    </>
  )
}
