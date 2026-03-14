import { Award, Users, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { KPICard } from '@/components/distribuidor/KPICard'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { useClientesExcelencia } from '@/hooks/useClientesExcelencia'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function ExcelenciaList() {
  const { data: clientes, isLoading } = useClientesExcelencia()

  const total = clientes?.length ?? 0
  const ativos = clientes?.filter((c) => c.status === 'ativo').length ?? 0
  const emRisco = clientes?.filter((c) => c.status === 'em_risco').length ?? 0

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Plano de Excelência"
        description="Clientes estratégicos dos distribuidores"
      />

      <KPIGrid columns={4}>
        <KPICard
          label="Total no Plano"
          value={total}
          icon={Users}
        />
        <KPICard
          label="100% Critérios"
          value={ativos}
          icon={CheckCircle2}
          variant="primary"
        />
        <KPICard
          label="Em Risco"
          value={emRisco}
          icon={XCircle}
        />
        <KPICard
          label="Adesão Geral"
          value={total > 0 ? `${((ativos / total) * 100).toFixed(0)}%` : '0%'}
          icon={Award}
        />
      </KPIGrid>

      <Card className="mt-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead className="text-right">Itens Cadastrados</TableHead>
              <TableHead>Última Compra</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !clientes || clientes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <Award className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Nenhum cliente no plano de excelência
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              clientes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="text-xs font-medium">
                      {c.nome_fantasia ?? c.razao_social}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {c.cnpj}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.cidade} - {c.estado}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-right">
                    {c.itens_cadastrados}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.ultima_compra
                      ? new Date(c.ultima_compra).toLocaleDateString('pt-BR')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
