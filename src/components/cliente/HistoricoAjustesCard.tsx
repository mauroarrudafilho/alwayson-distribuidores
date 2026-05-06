import { useState } from 'react'
import {
  History,
  Plus,
  FileText,
  MapPin,
  UserCircle,
  Tag,
  Hash,
  HelpCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useAjustesPorCliente,
  TIPO_LABELS,
  MOTIVO_LABELS,
  type AjusteTipo,
} from '@/hooks/useMockAjustesCadastro'
import { AjusteCadastroDialog, type AjusteClienteContext } from './AjusteCadastroDialog'

const TIPO_ICONS: Record<AjusteTipo, typeof FileText> = {
  cnpj:          Hash,
  razao_social:  FileText,
  nome_fantasia: Tag,
  endereco:      MapPin,
  vendedor:      UserCircle,
  outro:         HelpCircle,
}

interface Props {
  cliente: AjusteClienteContext
}

export function HistoricoAjustesCard({ cliente }: Props) {
  const [open, setOpen] = useState(false)
  const ajustes = useAjustesPorCliente(cliente.id)
  const ativos = ajustes.filter((a) => !a.reverted_em)

  return (
    <Card>
      <CardHeader className="border-b flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" />
          Ajustes de cadastro
          {ativos.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {ativos.length} {ativos.length === 1 ? 'ajuste' : 'ajustes'}
            </Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo ajuste
        </Button>
      </CardHeader>
      <CardContent className="pt-4">
        {ajustes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum ajuste de cadastro registrado.
          </p>
        ) : (
          <ul className="space-y-3">
            {ajustes.map((a) => {
              const Icon = TIPO_ICONS[a.tipo]
              const isCnpj = a.tipo === 'cnpj'
              return (
                <li
                  key={a.id}
                  className={
                    a.reverted_em
                      ? 'flex items-start gap-3 opacity-60'
                      : 'flex items-start gap-3'
                  }
                >
                  <div className="mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {TIPO_LABELS[a.tipo]}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {MOTIVO_LABELS[a.motivo]}
                      </Badge>
                      {a.reverted_em && (
                        <Badge variant="secondary" className="text-[10px]">
                          Revertido
                        </Badge>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${isCnpj ? 'font-mono' : ''}`}>
                      <span className="line-through text-muted-foreground/70">{a.valor_anterior}</span>
                      {' → '}
                      <span className="font-medium">{a.valor_atual}</span>
                    </p>
                    {a.observacao && (
                      <p className="text-xs text-muted-foreground mt-0.5">{a.observacao}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Registrado por {a.criado_por} em{' '}
                      {new Date(a.criado_em).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {a.reverted_em && (
                        <>
                          {' · '}revertido em{' '}
                          {new Date(a.reverted_em).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <AjusteCadastroDialog open={open} onOpenChange={setOpen} cliente={cliente} />
    </Card>
  )
}
