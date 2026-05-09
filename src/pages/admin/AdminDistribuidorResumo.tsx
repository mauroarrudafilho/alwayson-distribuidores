import { Link, useParams } from 'react-router-dom'
import { MapPin, Mail, Phone, User, Link2, Target, Network } from 'lucide-react'
import { useDistribuidor } from '@/hooks/useDistribuidores'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export function AdminDistribuidorResumo() {
  const { distribuidorId = '' } = useParams<{ distribuidorId: string }>()
  const { data: dist, isLoading, isError } = useDistribuidor(distribuidorId || undefined)
  const base = `/admin/distribuidores/${distribuidorId}`

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    )
  }

  if (isError || !dist) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Cadastro</h3>
            <dl className="space-y-2 text-xs text-muted-foreground">
              <div className="flex gap-2">
                <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <dt className="sr-only">Responsável</dt>
                  <dd>{dist.responsavel || '—'}</dd>
                </div>
              </div>
              <div className="flex gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <dt className="sr-only">Local</dt>
                  <dd>
                    {dist.cidade}, {dist.estado}
                  </dd>
                </div>
              </div>
              {dist.telefone && (
                <div className="flex gap-2">
                  <Phone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <dt className="sr-only">Telefone</dt>
                    <dd className="tabular-nums">{dist.telefone}</dd>
                  </div>
                </div>
              )}
              {dist.email && (
                <div className="flex gap-2">
                  <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <dt className="sr-only">E-mail</dt>
                    <dd>{dist.email}</dd>
                  </div>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Parâmetros neste distribuidor</h3>
            <p className="text-xs text-muted-foreground">
              Associe códigos de produto do distribuidor ao catálogo principal, defina metas por
              hierarquia e consulte o organograma ativo para alinhar cadastros.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to={`${base}/de-para-produtos`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'justify-start gap-2 inline-flex'
                )}
              >
                <Link2 className="w-3.5 h-3.5" />
                Correlação de Produtos
              </Link>
              <Link
                to={`${base}/metas`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'justify-start gap-2 inline-flex'
                )}
              >
                <Target className="w-3.5 h-3.5" />
                Metas
              </Link>
              <Link
                to={`${base}/hierarquia`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'justify-start gap-2 inline-flex'
                )}
              >
                <Network className="w-3.5 h-3.5" />
                Hierarquia comercial
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Operacional: ver métricas e drill-down em{' '}
        <Link to="/performance" className="text-primary underline-offset-2 hover:underline">
          Performance
        </Link>
        .
      </p>
    </div>
  )
}
