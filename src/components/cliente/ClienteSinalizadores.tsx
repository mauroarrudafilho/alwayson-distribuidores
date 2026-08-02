import { ClientTag, ClientTagStack } from '@/components/distribuidor/ClientTag'
import { buildClienteSinalizadores } from '@/lib/cliente-sinalizadores'
import { useIdsEstrategicos } from '@/hooks/useClientesEstrategicos'
import type { ClienteDistribuidor } from '@/types/distribuidor'
import type { ClienteFatResumo } from '@/lib/cliente-faturamento-resumo'

interface Props {
  cliente: ClienteDistribuidor
  resumo?: ClienteFatResumo
  isTopComprador?: boolean
  /** Sobrepõe a consulta à lista curada — útil quando quem chama já sabe. */
  clienteEstrategico?: boolean
  className?: string
  /** Lista compacta na tabela — máx. 2 badges, labels curtos. */
  compact?: boolean
  maxTags?: number
}

export function ClienteSinalizadores({
  cliente,
  resumo,
  isTopComprador,
  clienteEstrategico,
  className,
  compact,
  maxTags,
}: Props) {
  // Uma única query partilhada (chave fixa + staleTime), mesmo renderizado por
  // linha de tabela: o React Query desduplica.
  const { data: idsEstrategicos } = useIdsEstrategicos()

  const input = {
    cliente,
    resumo,
    isTopComprador,
    clienteEstrategico: clienteEstrategico ?? idsEstrategicos?.has(cliente.id) ?? false,
  }
  const allTags = buildClienteSinalizadores(input, {
    compact,
    maxTags: maxTags ?? (compact ? 2 : undefined),
  })

  if (allTags.length === 0) return null

  const visible = allTags
  const hiddenCount =
    buildClienteSinalizadores(input).length - visible.length

  return (
    <ClientTagStack className={className}>
      {visible.map((tag) => (
        <ClientTag
          key={tag.id}
          category={tag.category}
          label={tag.label}
          className={tag.title ? 'cursor-default' : undefined}
          title={tag.title}
        />
      ))}
      {hiddenCount > 0 && (
        <ClientTag
          category="segmento"
          label={`+${hiddenCount}`}
          title={`Mais ${hiddenCount} sinalização(ões)`}
        />
      )}
    </ClientTagStack>
  )
}
