import { Network } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

export function AdminAjustesRedesTemplateVendas() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Ajuste de Redes" />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="rounded-full bg-muted p-4">
            <Network className="w-8 h-8 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Em breve você poderá gerenciar as redes ligadas ao template de vendas dos distribuidores
            neste espaço.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
