import { Users, ShieldCheck, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Badge } from '@/components/ui/badge'

const ROLES_PLANEJADOS = [
  {
    nome: 'Executivo AlwaysOn',
    descricao: 'Acesso total a todos os distribuidores, performance, clientes e administração.',
    permissoes: ['Dashboard', 'Performance', 'Clientes', 'Excelência', 'Estoque', 'Ingestão', 'Admin'],
  },
  {
    nome: 'Liderança Distribuidor',
    descricao: 'Acesso restrito ao próprio distribuidor. Visualiza performance, clientes e estoque do seu escopo.',
    permissoes: ['Dashboard (próprio)', 'Performance (próprio)', 'Clientes (próprio)', 'Estoque (próprio)'],
  },
]

export function AdminUsuarios() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/40 border border-border/50">
        <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">Módulo em desenvolvimento</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A gestão de usuários e controle de acesso será habilitada na próxima versão.
            Abaixo estão os perfis de acesso planejados.
          </p>
        </div>
      </div>

      <div>
        <SectionTitle title="Perfis de Acesso Planejados" icon={ShieldCheck} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {ROLES_PLANEJADOS.map((role) => (
            <Card key={role.nome}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">{role.nome}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{role.descricao}</p>
                <div className="flex flex-wrap gap-1.5">
                  {role.permissoes.map((p) => (
                    <Badge key={p} variant="secondary">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
