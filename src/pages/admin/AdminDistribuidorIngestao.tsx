import { useParams } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { IngestaoUpload } from '@/components/distribuidor/IngestaoUpload'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRelatoriosIngestao } from '@/hooks/useRelatoriosIngestao'

function statusType(status: string): 'pendente' | 'processando' | 'concluido' | 'erro' {
  return ['pendente', 'processando', 'concluido', 'erro'].includes(status)
    ? (status as 'pendente' | 'processando' | 'concluido' | 'erro')
    : 'pendente'
}

/**
 * Ingestão dentro do parceiro: o distribuidor vem da rota, então o formulário
 * já nasce com metade do contexto resolvido e só oferece os fornecedores
 * vinculados a ele. Elimina a possibilidade de carimbar o arquivo na
 * combinação errada — o histórico abaixo é do próprio parceiro.
 */
export function AdminDistribuidorIngestao() {
  const { distribuidorId = '' } = useParams<{ distribuidorId: string }>()
  const { data: relatorios, isLoading } = useRelatoriosIngestao(distribuidorId || undefined)

  return (
    <div className="space-y-6">
      <IngestaoUpload distribuidorFixo={distribuidorId} />

      <Card>
        <CardContent className="p-3">
          <SectionTitle title="Histórico deste parceiro" icon={FileText} />
          {isLoading ? (
            <div className="mt-2 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (relatorios ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum arquivo enviado para este parceiro ainda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(relatorios ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium max-w-[260px] truncate">
                      {r.arquivo_nome}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {r.tipo}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.periodo_referencia}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-right">
                      {r.registros_processados ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={statusType(r.status)} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.criado_em ? new Date(r.criado_em).toLocaleString('pt-BR') : '—'}
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
