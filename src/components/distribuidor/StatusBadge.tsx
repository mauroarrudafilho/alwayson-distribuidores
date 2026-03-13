import { cn } from '@/lib/utils'

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

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  ativo: {
    label: 'Ativo',
    className: 'bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm',
  },
  inativo: {
    label: 'Inativo',
    className: 'bg-slate-100 text-slate-600 border-slate-300 font-semibold',
  },
  em_analise: {
    label: 'Em Análise',
    className: 'bg-amber-100 text-amber-700 border-amber-300 font-semibold',
  },
  em_risco: {
    label: 'Em Risco',
    className: 'bg-amber-100 text-amber-700 border-amber-300 font-semibold',
  },
  critico: {
    label: 'Crítico',
    className: 'bg-red-50 text-red-700 border-red-200 font-semibold',
  },
  ruptura: {
    label: 'Ruptura',
    className: 'bg-red-50 text-red-700 border-red-200 font-semibold',
  },
  baixo: {
    label: 'Baixo',
    className: 'bg-amber-100 text-amber-700 border-amber-300 font-semibold',
  },
  normal: {
    label: 'Normal',
    className: 'bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm',
  },
  excelencia: {
    label: 'Excelência',
    className: 'bg-violet-100 text-violet-700 border-violet-300 font-semibold',
  },
  pendente: {
    label: 'Pendente',
    className: 'bg-slate-100 text-slate-600 border-slate-300 font-semibold',
  },
  processando: {
    label: 'Processando',
    className: 'bg-blue-100 text-blue-700 border-blue-300 font-semibold',
  },
  concluido: {
    label: 'Concluído',
    className: 'bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm',
  },
  erro: {
    label: 'Erro',
    className: 'bg-red-50 text-red-700 border-red-200 font-semibold',
  },
}

interface StatusBadgeProps {
  status: StatusType
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] rounded-sm px-1.5 py-0.5 border',
        config.className
      )}
    >
      {label ?? config.label}
    </span>
  )
}
