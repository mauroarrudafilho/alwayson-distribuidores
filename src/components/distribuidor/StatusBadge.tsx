import { Badge } from '@/components/ui/badge'

type StatusType =
  | 'ativo'
  | 'inativo'
  | 'em_analise'
  | 'em_risco'
  | 'critico'
  | 'ruptura'
  | 'baixo'
  | 'normal'
  | 'excelencia'
  | 'pendente'
  | 'processando'
  | 'concluido'
  | 'erro'

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'accent'

const statusConfig: Record<StatusType, { label: string; variant: BadgeVariant }> = {
  ativo:        { label: 'Ativo',        variant: 'success' },
  normal:       { label: 'Normal',       variant: 'success' },
  concluido:    { label: 'Concluido',    variant: 'success' },
  em_analise:   { label: 'Em Analise',   variant: 'info' },
  processando:  { label: 'Processando',  variant: 'info' },
  em_risco:     { label: 'Em Risco',     variant: 'warning' },
  baixo:        { label: 'Baixo',        variant: 'warning' },
  pendente:     { label: 'Pendente',     variant: 'warning' },
  critico:      { label: 'Critico',      variant: 'destructive' },
  ruptura:      { label: 'Ruptura',      variant: 'destructive' },
  erro:         { label: 'Erro',         variant: 'destructive' },
  inativo:      { label: 'Inativo',      variant: 'secondary' },
  excelencia:   { label: 'Excelencia',   variant: 'accent' },
}

interface StatusBadgeProps {
  status: StatusType
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge variant={config.variant}>
      {label ?? config.label}
    </Badge>
  )
}
