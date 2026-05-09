import { useParams, Link } from 'react-router-dom'
import { Network } from 'lucide-react'
import { useVendedorHierarchy } from '@/hooks/usePerformanceHierarchy'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { Vendedor } from '@/types/distribuidor'

function Pessoa({ v }: { v: Vendedor }) {
  return (
    <div className="rounded border border-border/60 bg-muted/20 px-2 py-1.5 text-xs">
      <div className="font-medium text-foreground">{v.nome}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="text-[10px] capitalize">
          {v.tipo}
        </Badge>
        {v.codigo_externo && (
          <span className="text-[10px] text-muted-foreground font-mono">{v.codigo_externo}</span>
        )}
      </div>
    </div>
  )
}

function SupervisorBranch({
  supervisor,
  vendedores,
}: {
  supervisor: Vendedor
  vendedores: Vendedor[]
}) {
  const team = vendedores.filter((x) => x.tipo === 'vendedor' && x.supervisor_id === supervisor.id)
  return (
    <li className="space-y-2">
      <Pessoa v={supervisor} />
      {team.length > 0 && (
        <ul className="ml-4 space-y-2 border-l border-border/50 pl-3">
          {team.map((v) => (
            <li key={v.id}>
              <Pessoa v={v} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function AdminDistribuidorHierarquia() {
  const { distribuidorId = '' } = useParams<{ distribuidorId: string }>()
  const { data: h, isLoading, isError } = useVendedorHierarchy(distribuidorId || undefined)
  const base = `/admin/distribuidores/${distribuidorId}`

  if (isLoading) {
    return <Skeleton className="h-48 w-full max-w-2xl" />
  }

  if (isError || !h) {
    return (
      <p className="text-sm text-destructive">
        Não foi possível carregar a hierarquia. Verifique o cadastro de vendedores.
      </p>
    )
  }

  const { gerentes, vendedores } = h

  if (gerentes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-xs text-muted-foreground">
          <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
          Nenhum gerente ativo cadastrado para este distribuidor. Inclua registros em{' '}
          <span className="text-foreground">alwayson_vendedores_distribuidor</span> ou via fluxo de
          ingestão de cadastro.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-muted-foreground">
        Estrutura ativa (somente leitura). Para metas nominais por pessoa, use a aba{' '}
        <Link to={`${base}/metas`} className="text-primary underline-offset-2 hover:underline">
          Metas
        </Link>
        ; para associação de SKUs do distribuidor ao catálogo,{' '}
        <Link
          to={`${base}/de-para-produtos`}
          className="text-primary underline-offset-2 hover:underline"
        >
          De-para produtos
        </Link>
        .
      </p>

      <ul className="space-y-4">
        {gerentes.map((g) => {
          const sups = vendedores.filter(
            (x) => x.tipo === 'supervisor' && x.supervisor_id === g.id
          )
          return (
            <li key={g.id} className="space-y-2">
              <Pessoa v={g} />
              {sups.length > 0 ? (
                <ul className="ml-4 space-y-3 border-l border-border/50 pl-3">
                  {sups.map((s) => (
                    <SupervisorBranch key={s.id} supervisor={s} vendedores={vendedores} />
                  ))}
                </ul>
              ) : (
                <p className="ml-4 text-[11px] text-muted-foreground pl-3 border-l border-dashed border-border/50">
                  Sem supervisores ligados a este gerente (
                  <code className="text-foreground">supervisor_id</code>).
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
