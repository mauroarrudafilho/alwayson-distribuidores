import { FileText } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { IngestaoUpload } from '@/components/distribuidor/IngestaoUpload'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { useRelatoriosIngestao } from '@/hooks/useRelatoriosIngestao'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useDistribuidores } from '@/hooks/useDistribuidores'

export function IngestaoPanel() {
  const { data: relatorios, isLoading } = useRelatoriosIngestao()
  const { data: distribuidores } = useDistribuidores()

  const getDistribuidorNome = (id: string) =>
    distribuidores?.find((d) => d.id === id)?.nome ?? '-'

  const getStatusType = (
    status: string
  ): 'pendente' | 'processando' | 'concluido' | 'erro' =>
    ['pendente', 'processando', 'concluido', 'erro'].includes(status)
      ? (status as 'pendente' | 'processando' | 'concluido' | 'erro')
      : 'pendente'

  return (
    <div>
      <PageHeader
        title="Ingestão de Relatórios"
        description="Envie relatórios de vendas, estoque ou clientes para processamento"
      />

      <IngestaoUpload className="mb-4" />

      <Card className="rounded-md border border-border/50 shadow-none">
        <CardContent className="p-3">
          <SectionTitle title="Histórico de Ingestões" icon={FileText} />
          {isLoading ? (
            <div className="mt-2 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !relatorios || relatorios.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Nenhum relatório enviado ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Arquivo
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Distribuidor
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Tipo
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Período
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8 text-right">
                    Registros
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Status
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
                    Data
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorios.map((r) => (
                  <TableRow
                    key={r.id}
                    className="hover:bg-muted/30 border-border/30"
                  >
                    <TableCell className="py-1.5 text-xs font-medium">
                      {r.arquivo_nome}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {getDistribuidorNome(r.distribuidor_id)}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs capitalize">
                      {r.tipo}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {r.periodo_referencia
                        ? new Date(r.periodo_referencia).toLocaleDateString(
                            'pt-BR'
                          )
                        : '-'}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs tabular-nums text-right">
                      {r.registros_processados ?? '-'}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <StatusBadge status={getStatusType(r.status)} />
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">
                      {new Date(r.criado_em).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
