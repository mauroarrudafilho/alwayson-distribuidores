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
    <div className="animate-fade-in">
      <PageHeader
        title="Ingestão de Relatórios"
        description="Envie relatórios de vendas, estoque ou clientes para processamento"
      />

      <IngestaoUpload className="mb-6" />

      <Card>
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
                <TableRow className="hover:bg-transparent">
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Distribuidor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorios.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">
                      {r.arquivo_nome}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {getDistribuidorNome(r.distribuidor_id)}
                    </TableCell>
                    <TableCell className="text-xs capitalize">
                      {r.tipo}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.periodo_referencia
                        ? new Date(r.periodo_referencia).toLocaleDateString(
                            'pt-BR'
                          )
                        : '-'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
                      {r.registros_processados ?? '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={getStatusType(r.status)} />
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
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
