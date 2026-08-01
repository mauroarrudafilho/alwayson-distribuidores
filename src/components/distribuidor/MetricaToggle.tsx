import { cn } from '@/lib/utils'
import type { MetricaAnalise } from '@/lib/metrica-analise'

interface Props {
  value: MetricaAnalise
  onChange: (v: MetricaAnalise) => void
  className?: string
  size?: 'sm' | 'default'
}

export function MetricaToggle({ value, onChange, className, size = 'default' }: Props) {
  const btn = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <div
      className={cn(
        'inline-flex rounded-md border bg-muted/30 p-0.5',
        className
      )}
      role="group"
      aria-label="Métrica de análise"
    >
      {(['faturamento', 'unidade'] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            'rounded font-medium transition-colors',
            btn,
            value === m
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {m === 'faturamento' ? 'R$' : 'Un.'}
        </button>
      ))}
    </div>
  )
}
