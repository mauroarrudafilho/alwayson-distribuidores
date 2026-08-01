import { Search } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
}

/** Busca universal alinhada a Clientes / Admin (ícone + input group). */
export function InsightsSearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  id,
}: Props) {
  return (
    <InputGroup className="h-9">
      <InputGroupAddon>
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </InputGroup>
  )
}
