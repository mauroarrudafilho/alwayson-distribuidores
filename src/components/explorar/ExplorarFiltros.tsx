import { FilterField } from '@/components/distribuidor/FilterBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { labelFromOptions } from '@/lib/entity-labels'
import { cn } from '@/lib/utils'

/** Campo somente leitura — nome do parceiro/fornecedor, nunca UUID. */
export function FilterReadonly({ label, value }: { label: string; value: string }) {
  return (
    <FilterField label={label}>
      <div
        className={cn(
          'flex h-8 items-center rounded-lg border border-border/50 bg-muted/20 px-2.5 text-sm text-foreground'
        )}
      >
        {value}
      </div>
    </FilterField>
  )
}

type Option = { id: string; nome: string }

export function FilterEntitySelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (id: string) => void
  placeholder: string
  disabled?: boolean
}) {
  const labelText = labelFromOptions(value, options, placeholder)
  const valueOk = value && options.some((o) => o.id === value)

  return (
    <FilterField label={label}>
      <Select
        value={valueOk ? value : null}
        onValueChange={(v) => v && onChange(v)}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue placeholder={placeholder}>{labelText}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}

export function FilterCidadeSelect({
  value,
  cidades,
  onChange,
}: {
  value: number | 'all'
  cidades: Array<{ codigo_ibge: number; cidade_exibicao: string; estado: string }>
  onChange: (v: number | 'all') => void
}) {
  if (cidades.length === 0) return null

  if (cidades.length === 1) {
    const c = cidades[0]
    return (
      <FilterReadonly
        label="Cidade"
        value={`${c.cidade_exibicao} / ${c.estado}`}
      />
    )
  }

  const label =
    value === 'all'
      ? 'Todas as cidades'
      : (() => {
          const c = cidades.find((x) => x.codigo_ibge === value)
          return c ? `${c.cidade_exibicao} / ${c.estado}` : 'Todas as cidades'
        })()

  return (
    <FilterField label="Cidade">
      <Select
        value={value === 'all' ? 'all' : String(value)}
        onValueChange={(v) => {
          if (!v || v === 'all') onChange('all')
          else onChange(Number(v))
        }}
      >
        <SelectTrigger className="h-8 w-full text-sm">
          <SelectValue placeholder="Todas as cidades">{label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as cidades</SelectItem>
          {cidades.map((c) => (
            <SelectItem key={c.codigo_ibge} value={String(c.codigo_ibge)}>
              {c.cidade_exibicao} / {c.estado}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
}
