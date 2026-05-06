import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, Undo2, FileSearch, Layers, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { KPICard } from '@/components/distribuidor/KPICard'
import {
  useTodosAjustes,
  reverterAjuste,
  TIPO_LABELS,
  MOTIVO_LABELS,
  type AjusteTipo,
} from '@/hooks/useMockAjustesCadastro'
import { AjusteCadastroDialog } from '@/components/cliente/AjusteCadastroDialog'

export function AdminAjustesCadastro() {
  const navigate = useNavigate()
  const todos = useTodosAjustes()
  const [busca, setBusca] = useState('')
  const [tipoFilter, setTipoFilter] = useState<AjusteTipo | ''>('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'revertidos'>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtrados = useMemo(() => {
    return todos.filter((a) => {
      const buscaDigits = busca.replace(/\D/g, '')
      const matchBusca =
        busca === '' ||
        a.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
        a.valor_anterior.toLowerCase().includes(busca.toLowerCase()) ||
        a.valor_atual.toLowerCase().includes(busca.toLowerCase()) ||
        (buscaDigits.length >= 3 &&
          (a.valor_anterior.replace(/\D/g, '').includes(buscaDigits) ||
            a.valor_atual.replace(/\D/g, '').includes(buscaDigits)))
      const matchTipo = tipoFilter === '' || a.tipo === tipoFilter
      const matchStatus =
        statusFilter === 'todos' ||
        (statusFilter === 'ativos' && !a.reverted_em) ||
        (statusFilter === 'revertidos' && !!a.reverted_em)
      return matchBusca && matchTipo && matchStatus
    })
  }, [todos, busca, tipoFilter, statusFilter])

  const totais = useMemo(() => {
    const ativos = todos.filter((a) => !a.reverted_em).length
    const revertidos = todos.filter((a) => a.reverted_em).length
    const tiposAtivos = todos.reduce<Record<string, number>>((acc, a) => {
      if (a.reverted_em) return acc
      acc[a.tipo] = (acc[a.tipo] ?? 0) + 1
      return acc
    }, {})
    const tipoMaisComum = Object.entries(tiposAtivos).sort(([, a], [, b]) => b - a)[0]
    return {
      total: todos.length,
      ativos,
      revertidos,
      tipoMaisComum: tipoMaisComum ? TIPO_LABELS[tipoMaisComum[0] as AjusteTipo] : '—',
    }
  }, [todos])

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} className="h-9 text-sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Novo ajuste
        </Button>
      </div>

      <KPIGrid columns={4}>
        <KPICard label="Ajustes Ativos"      value={totais.ativos}        icon={History} variant="primary" />
        <KPICard label="Revertidos"           value={totais.revertidos}    icon={Undo2} />
        <KPICard label="Total Histórico"      value={totais.total}          icon={FileSearch} />
        <KPICard label="Tipo Mais Comum"     value={totais.tipoMaisComum}  icon={Layers} />
      </KPIGrid>

      <FilterBar columns={3}>
        <FilterField label="Buscar cliente, valor ou CNPJ">
          <Input
            placeholder="Bom Preço, Tambaú, 07891234…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-sm"
          />
        </FilterField>
        <FilterField label="Tipo de ajuste">
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={tipoFilter === '' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setTipoFilter('')}
            >
              Todos
            </Button>
            {(Object.keys(TIPO_LABELS) as AjusteTipo[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tipoFilter === t ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setTipoFilter(t)}
              >
                {TIPO_LABELS[t]}
              </Button>
            ))}
          </div>
        </FilterField>
        <FilterField label="Status">
          <div className="flex gap-1.5">
            {(['todos', 'ativos', 'revertidos'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'default' : 'outline'}
                className="h-8 text-xs capitalize"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </FilterField>
      </FilterBar>

      <SectionTitle title="Ajustes de cadastro" icon={History} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor Anterior</TableHead>
                <TableHead className="hidden md:table-cell">Valor Atual</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="hidden lg:table-cell">Observação</TableHead>
                <TableHead>Registrado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                    Nenhum ajuste encontrado para os filtros.
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((a) => {
                const isCnpj = a.tipo === 'cnpj'
                return (
                  <TableRow
                    key={a.id}
                    className={
                      a.reverted_em
                        ? 'opacity-60 cursor-pointer'
                        : 'cursor-pointer'
                    }
                    onClick={() => navigate(`/clientes/${a.cliente_id}`)}
                  >
                    <TableCell className="font-medium text-sm">{a.cliente_nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {TIPO_LABELS[a.tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-xs ${isCnpj ? 'font-mono' : ''} max-w-[200px] truncate`}>
                      {a.valor_anterior}
                    </TableCell>
                    <TableCell
                      className={`hidden md:table-cell text-xs text-muted-foreground ${
                        isCnpj ? 'font-mono' : ''
                      } max-w-[200px] truncate`}
                    >
                      {a.valor_atual}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {MOTIVO_LABELS[a.motivo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[240px] truncate">
                      {a.observacao || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.criado_em).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <div className="text-[10px]">{a.criado_por}</div>
                    </TableCell>
                    <TableCell>
                      {a.reverted_em ? (
                        <Badge variant="secondary" className="text-[10px]">Revertido</Badge>
                      ) : (
                        <Badge className="text-[10px]">Ativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!a.reverted_em && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`Reverter este ajuste?`)) {
                              reverterAjuste(a.id)
                            }
                          }}
                        >
                          <Undo2 className="w-3 h-3 mr-1" />
                          Reverter
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AjusteCadastroDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
