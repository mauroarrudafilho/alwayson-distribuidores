import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Star,
  Users,
  Flame,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { KPICard } from '@/components/distribuidor/KPICard'
import { ClienteEstrategicoDialog } from '@/components/distribuidor/ClienteEstrategicoDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatCnpj } from '@/lib/format'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  useClientesEstrategicos,
  useCriteriosEstrategicos,
  useRemoverClienteEstrategico,
} from '@/hooks/useClientesEstrategicos'
import {
  ORIGEM_LABELS,
  PRIORIDADE_LABELS,
  ORIGENS_ESTRATEGICAS,
  PRIORIDADES,
  type ClienteEstrategicoComCliente,
} from '@/types/clientes-estrategicos'
import {
  buildCriteriosForCliente,
  dedupeCriterios,
  deriveScoreLabel,
  STATUS_CELL_CLASSES,
  type AcompanhamentoLabel,
  type CriterioCell,
} from '@/lib/clientes-estrategicos-monitor'
import { cn } from '@/lib/utils'

type SortField = 'cliente' | 'prioridade' | 'adicionado'
type SortDir = 'asc' | 'desc'

const PRIORIDADE_PESO: Record<string, number> = { alta: 3, media: 2, baixa: 1 }

const ACOMPANHAMENTO_BADGE: Record<AcompanhamentoLabel, { label: string; className: string }> = {
  aderente: { label: 'Aderente', className: 'text-emerald-600 dark:text-emerald-400' },
  em_risco: { label: 'Em risco', className: 'text-amber-600 dark:text-amber-400' },
  fora_do_padrao: { label: 'Fora do padrão', className: 'text-red-600 dark:text-red-400' },
  sem_criterios: { label: 'Sem régua', className: 'text-muted-foreground' },
}

interface LinhaEstrategica {
  registro: ClienteEstrategicoComCliente
  nome: string
  criterios: CriterioCell[]
  acompanhamento: AcompanhamentoLabel
}

/**
 * Clientes Estratégicos — lista curada e **manual**.
 *
 * Não é derivada de faturamento nem de flag da ingestão: cada linha entrou
 * porque alguém decidiu, e o motivo fica registado ao lado do cliente. Os
 * critérios de acompanhamento são uma camada opcional por cima — a lista existe
 * e vale mesmo sem nenhum critério configurado.
 */
export function ClientesEstrategicos() {
  const [distribuidorId, setDistribuidorId] = useState<string>()
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>('todas')
  const [origemFiltro, setOrigemFiltro] = useState<string>('todas')
  const [sortField, setSortField] = useState<SortField>('prioridade')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [dialogAberto, setDialogAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<ClienteEstrategicoComCliente | null>(null)

  const { data: distribuidores } = useDistribuidores()
  const { data: lista, isLoading } = useClientesEstrategicos(distribuidorId)
  const { data: criteriosConfig } = useCriteriosEstrategicos(distribuidorId)
  const remover = useRemoverClienteEstrategico()

  const colunas = useMemo(() => dedupeCriterios(criteriosConfig ?? []), [criteriosConfig])

  const linhas = useMemo<LinhaEstrategica[]>(() => {
    return (lista ?? []).map((registro) => {
      const cliente = registro.cliente
      const criterios = cliente ? buildCriteriosForCliente(colunas, cliente) : []
      return {
        registro,
        nome: cliente?.nome_fantasia || cliente?.razao_social || 'Cliente removido',
        criterios,
        acompanhamento: deriveScoreLabel(criterios),
      }
    })
  }, [lista, colunas])

  const linhasFiltradas = useMemo(() => {
    let result = linhas
    if (prioridadeFiltro !== 'todas') {
      result = result.filter((l) => l.registro.prioridade === prioridadeFiltro)
    }
    if (origemFiltro !== 'todas') {
      result = result.filter((l) => l.registro.origem === origemFiltro)
    }

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortField === 'cliente') cmp = a.nome.localeCompare(b.nome)
      else if (sortField === 'prioridade') {
        cmp =
          (PRIORIDADE_PESO[a.registro.prioridade] ?? 0) -
          (PRIORIDADE_PESO[b.registro.prioridade] ?? 0)
      } else {
        cmp = a.registro.adicionado_em.localeCompare(b.registro.adicionado_em)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [linhas, prioridadeFiltro, origemFiltro, sortField, sortDir])

  const kpis = useMemo(() => {
    const total = linhas.length
    const alta = linhas.filter((l) => l.registro.prioridade === 'alta').length
    const atencao = linhas.filter(
      (l) => l.registro.cliente?.status === 'em_risco' || l.registro.cliente?.status === 'inativo'
    ).length
    const aderentes = linhas.filter((l) => l.acompanhamento === 'aderente').length
    return { total, alta, atencao, aderentes }
  }, [linhas])

  const idsNaLista = useMemo(() => (lista ?? []).map((r) => r.cliente_id), [lista])

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir(field === 'cliente' ? 'asc' : 'desc')
    }
  }

  function abrirNovo() {
    setEmEdicao(null)
    setDialogAberto(true)
  }

  function abrirEdicao(registro: ClienteEstrategicoComCliente) {
    setEmEdicao(registro)
    setDialogAberto(true)
  }

  async function handleRemover(registro: ClienteEstrategicoComCliente) {
    const nome = registro.cliente?.nome_fantasia || registro.cliente?.razao_social || 'este cliente'
    if (!window.confirm(`Tirar ${nome} da lista estratégica?`)) return
    try {
      await remover.mutateAsync(registro.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Clientes Estratégicos"
        accent="curadoria"
        description="lista manual — cada cliente entra com o seu próprio motivo"
        actions={
          <Button size="sm" onClick={abrirNovo} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar cliente
          </Button>
        }
      />

      <FilterBar columns={3}>
        <FilterField label="Distribuidor">
          <Select
            value={distribuidorId ?? 'todos'}
            onValueChange={(v) => setDistribuidorId(v === 'todos' ? undefined : (v as string))}
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
        <FilterField label="Prioridade">
          <Select value={prioridadeFiltro} onValueChange={(v) => setPrioridadeFiltro(v ?? 'todas')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Origem">
          <Select value={origemFiltro} onValueChange={(v) => setOrigemFiltro(v ?? 'todas')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {ORIGENS_ESTRATEGICAS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      <div className="mb-6">
        <KPIGrid columns={4}>
          <KPICard label="Na lista" value={isLoading ? '—' : kpis.total} icon={Users} />
          <KPICard
            label="Alta prioridade"
            value={isLoading ? '—' : kpis.alta}
            icon={Flame}
            variant="primary"
          />
          <KPICard
            label="Em risco ou inativos"
            value={isLoading ? '—' : kpis.atencao}
            icon={AlertTriangle}
            subtitle="status do cliente na carteira"
          />
          <KPICard
            label="Aderentes"
            value={isLoading ? '—' : colunas.length === 0 ? '—' : kpis.aderentes}
            icon={Star}
            subtitle={
              colunas.length === 0 ? 'sem critérios configurados' : `${colunas.length} critério(s)`
            }
          />
        </KPIGrid>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-3">
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : linhasFiltradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {linhas.length === 0
                ? 'A lista estratégica está vazia — adicione o primeiro cliente.'
                : 'Nenhum cliente para o filtro selecionado.'}
            </p>
            {linhas.length === 0 && (
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={abrirNovo}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() => toggleSort('cliente')}
                    >
                      Cliente
                      <ArrowUpDown
                        className={cn(
                          'h-3 w-3',
                          sortField === 'cliente'
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        )}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[220px]">Motivo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 transition-colors hover:text-foreground"
                      onClick={() => toggleSort('prioridade')}
                    >
                      Prioridade
                      <ArrowUpDown
                        className={cn(
                          'h-3 w-3',
                          sortField === 'prioridade'
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                        )}
                      />
                    </button>
                  </TableHead>
                  {colunas.map((c) => (
                    <TableHead key={c.id} className="text-center">
                      {c.criterio_nome}
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Acompanhamento</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasFiltradas.map(({ registro, nome, criterios, acompanhamento }) => (
                  <TableRow key={registro.id}>
                    <TableCell>
                      {registro.cliente ? (
                        <Link
                          to={`/clientes/${registro.cliente_id}`}
                          className="font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {nome}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{nome}</span>
                      )}
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {registro.cliente ? formatCnpj(registro.cliente.cnpj) : '—'}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {registro.motivo || (
                        <span className="italic text-muted-foreground/70">sem motivo registado</span>
                      )}
                      {registro.observacao && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          {registro.observacao}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {registro.origem ? ORIGEM_LABELS[registro.origem] : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          registro.prioridade === 'alta'
                            ? 'destructive'
                            : registro.prioridade === 'media'
                              ? 'warning'
                              : 'secondary'
                        }
                      >
                        {PRIORIDADE_LABELS[registro.prioridade]}
                      </Badge>
                    </TableCell>
                    {criterios.map((cel) => {
                      const isMoeda = cel.criterio_nome.includes('R$')
                      const display =
                        cel.realizado === null
                          ? '—'
                          : isMoeda
                            ? formatCurrency(cel.realizado)
                            : cel.realizado.toLocaleString('pt-BR')
                      return (
                        <TableCell
                          key={cel.criterio_nome}
                          className={cn(
                            'text-center font-medium tabular-nums',
                            STATUS_CELL_CLASSES[cel.status]
                          )}
                        >
                          {display}
                        </TableCell>
                      )
                    })}
                    <TableCell
                      className={cn(
                        'text-center text-xs font-medium',
                        ACOMPANHAMENTO_BADGE[acompanhamento].className
                      )}
                    >
                      {ACOMPANHAMENTO_BADGE[acompanhamento].label}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => abrirEdicao(registro)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemover(registro)}
                          disabled={remover.isPending}
                          aria-label="Remover da lista"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {colunas.length === 0 && linhas.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nenhum critério de acompanhamento configurado ainda — a coluna de acompanhamento fica sem
          régua até existir pelo menos um critério para o distribuidor.
        </p>
      )}

      {/* Montado só quando aberto: o estado do formulário nasce dos props. */}
      {dialogAberto && (
        <ClienteEstrategicoDialog
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          distribuidorPadrao={distribuidorId}
          idsNaLista={idsNaLista}
          registro={emEdicao}
        />
      )}
    </div>
  )
}
