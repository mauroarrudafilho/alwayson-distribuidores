import { useState, useMemo } from 'react'
import { Award, Settings2, Users } from 'lucide-react'
import { StatusBadge } from '@/components/distribuidor/StatusBadge'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { useExcelenciaConfigs, useExcelenciaClientes } from '@/hooks/useExcelenciaConfig'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminExcelencia() {
  const { data: distribuidores } = useDistribuidores()
  const { data: configs, isLoading: loadingConfigs } = useExcelenciaConfigs(
    undefined,
    true
  )
  const { data: clientes, isLoading: loadingClientes } = useExcelenciaClientes(
    undefined,
    true
  )
  const [distribuidorFilter, setDistribuidorFilter] = useState<string>('todos')

  const distribuidorMap = useMemo(() => {
    const m = new Map<string, string>()
    ;(distribuidores ?? []).forEach((d) => m.set(d.id, d.nome))
    return m
  }, [distribuidores])

  const filteredConfigs = useMemo(() => {
    const list = configs ?? []
    if (distribuidorFilter === 'todos') return list
    return list.filter((c) => c.distribuidor_id === distribuidorFilter)
  }, [configs, distribuidorFilter])

  const filteredClientes = useMemo(() => {
    const list = clientes ?? []
    if (distribuidorFilter === 'todos') return list
    return list.filter((c) => c.distribuidor_id === distribuidorFilter)
  }, [clientes, distribuidorFilter])

  const isLoading = loadingConfigs || loadingClientes

  return (
    <div className="space-y-8">
      <FilterBar columns={2}>
        <FilterField label="Distribuidor">
          <Select
            value={distribuidorFilter}
            onValueChange={(v) => setDistribuidorFilter(v ?? 'todos')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {(distribuidores ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <div>
        <SectionTitle title="Critérios de Excelência" icon={Settings2} />
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Distribuidor</TableHead>
                <TableHead>Critério</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Comparação</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredConfigs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <Award className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Nenhum critério configurado
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredConfigs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">
                      {distribuidorMap.get(c.distribuidor_id) ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.criterio_nome}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.meta_valor}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.tipo_comparacao === 'min' ? 'Mínimo' : 'Máximo'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.ordem}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.ativo ? 'ativo' : 'inativo'} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div>
        <SectionTitle title="Clientes no Plano" icon={Users} />
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Distribuidor</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredClientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <Award className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Nenhum cliente no plano
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredClientes.map((ec) => (
                  <TableRow key={ec.id}>
                    <TableCell className="text-xs font-medium">
                      {distribuidorMap.get(ec.distribuidor_id) ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ec.cliente?.nome_fantasia ?? ec.cliente?.razao_social ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {ec.cliente?.cnpj ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ec.cliente
                        ? `${ec.cliente.cidade}/${ec.cliente.estado}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ec.ativo ? 'ativo' : 'inativo'} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
