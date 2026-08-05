import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, Users, Flame, MapPin, Plus, Pencil, Trash2, Search, List } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import { KPIGrid } from '@/components/distribuidor/KPIGrid'
import { KPICard } from '@/components/distribuidor/KPICard'
import { ClienteEstrategicoDialog } from '@/components/distribuidor/ClienteEstrategicoDialog'
import { ClientesEstrategicosMapa } from '@/components/distribuidor/ClientesEstrategicosMapa'
import { ClientesEstrategicosGeoCard } from '@/components/distribuidor/ClientesEstrategicosGeoCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { PaginationBar } from '@/components/ui/pagination-bar'
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
import { useAuth } from '@/contexts/auth'
import { formatCnpj } from '@/lib/format'
import {
  useClientesEstrategicos,
  useRemoverClienteEstrategico,
} from '@/hooks/useClientesEstrategicos'
import {
  PRIORIDADE_CLASSE,
  PRIORIDADE_LABELS,
  PRIORIDADES,
  type ClienteEstrategicoLinha,
} from '@/types/clientes-estrategicos'

type Situacao = 'todas' | 'na_carteira' | 'fora'

const PRIORIDADE_VARIANT: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  alta: 'destructive',
  media: 'warning',
  baixa: 'secondary',
}

/**
 * Clientes Estratégicos — lista curada e **manual**.
 *
 * Duas naturezas convivem aqui, e a coluna "Situação" é o que as separa:
 * - **Na carteira** — o CNPJ já é cliente de um parceiro; dá para acompanhar
 *   faturamento.
 * - **Fora da carteira** — alvo territorial. Entrou porque alguém decidiu que
 *   importa, mesmo sem ninguém a atender ainda. É o grosso de uma carga vinda
 *   de corte de mercado.
 *
 * O nome do PDV não é armazenado: a view resolve por fonte pública (carteira,
 * Receita Federal, histórico territorial). Onde nenhuma delas tem, fica só o
 * CNPJ — e isso é honesto, não uma falha.
 */
export function ClientesEstrategicos() {
  const [uf, setUf] = useState<string>('todas')
  const [cidade, setCidade] = useState<string>('todas')
  const [situacao, setSituacao] = useState<Situacao>('todas')
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(50)
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [dialogAberto, setDialogAberto] = useState(false)
  const [emEdicao, setEmEdicao] = useState<ClienteEstrategicoLinha | null>(null)

  const { isAdmin } = useAuth()
  const { data: lista, isLoading } = useClientesEstrategicos()
  const remover = useRemoverClienteEstrategico()

  const linhas = useMemo(() => lista ?? [], [lista])

  const ufs = useMemo(
    () => [...new Set(linhas.map((l) => l.estado_exibicao).filter(Boolean))].sort() as string[],
    [linhas]
  )

  /** Praças da UF escolhida. Sem UF a lista tem 459 entradas — inútil num select. */
  const cidades = useMemo(() => {
    if (uf === 'todas') return [] as string[]
    return [
      ...new Set(
        linhas.filter((l) => l.estado_exibicao === uf).map((l) => l.cidade_exibicao).filter(Boolean)
      ),
    ].sort() as string[]
  }, [linhas, uf])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const termoDigitos = termo.replace(/\D/g, '')

    return linhas.filter((l) => {
      if (uf !== 'todas' && l.estado_exibicao !== uf) return false
      if (cidade !== 'todas' && l.cidade_exibicao !== cidade) return false
      if (situacao === 'na_carteira' && !l.na_carteira) return false
      if (situacao === 'fora' && l.na_carteira) return false
      if (prioridadeFiltro !== 'todas' && l.prioridade !== prioridadeFiltro) return false
      if (termo) {
        const alvo = `${l.nome_exibicao ?? ''} ${l.cidade_exibicao ?? ''}`.toLowerCase()
        const casaTexto = alvo.includes(termo)
        const casaCnpj = termoDigitos.length >= 3 && l.cnpj.includes(termoDigitos)
        if (!casaTexto && !casaCnpj) return false
      }
      return true
    })
  }, [linhas, uf, cidade, situacao, prioridadeFiltro, busca])

  // A página corrente pode ficar além do fim quando o filtro encolhe o conjunto.
  const paginaSegura = Math.min(pagina, Math.max(1, Math.ceil(filtradas.length / porPagina)))
  const visiveis = filtradas.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina)

  const kpis = useMemo(() => {
    const total = linhas.length
    const naCarteira = linhas.filter((l) => l.na_carteira).length
    const alta = linhas.filter((l) => l.prioridade === 'alta').length
    const praças = new Set(linhas.map((l) => `${l.cidade_exibicao}/${l.estado_exibicao}`)).size
    return { total, naCarteira, fora: total - naCarteira, alta, praças }
  }, [linhas])

  /** Trocar de filtro volta à primeira página — senão fica-se numa página vazia. */
  function comReset<T extends string>(setter: (v: T) => void, padrao: T) {
    return (v: T | null) => {
      setter(v ?? padrao)
      setPagina(1)
    }
  }

  /** Trocar de UF invalida a cidade escolhida — ela pertence ao estado anterior. */
  function mudarUf(v: string | null) {
    setUf(v ?? 'todas')
    setCidade('todas')
    setPagina(1)
  }

  const filtrosAtivos =
    (busca.trim() ? 1 : 0) +
    (uf !== 'todas' ? 1 : 0) +
    (cidade !== 'todas' ? 1 : 0) +
    (situacao !== 'todas' ? 1 : 0) +
    (prioridadeFiltro !== 'todas' ? 1 : 0)

  function limparFiltros() {
    setBusca('')
    setUf('todas')
    setCidade('todas')
    setSituacao('todas')
    setPrioridadeFiltro('todas')
    setPagina(1)
  }

  function abrirNovo() {
    setEmEdicao(null)
    setDialogAberto(true)
  }

  async function handleRemover(linha: ClienteEstrategicoLinha) {
    const nome = linha.nome_exibicao || formatCnpj(linha.cnpj)
    if (!window.confirm(`Tirar ${nome} da lista estratégica?`)) return
    try {
      await remover.mutateAsync(linha.id)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return (
    <div className="animate-page-in">
      <PageHeader
        title="Clientes Estratégicos"
        accent="curadoria"
        description="curva ABC por estado — a prioridade vem do tamanho do PDV na própria praça"
        actions={
          <>
            <div className="flex rounded-md border border-border/70">
              <Button
                variant={vista === 'lista' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 rounded-r-none"
                onClick={() => setVista('lista')}
              >
                <List className="h-3.5 w-3.5" />
                Lista
              </Button>
              <Button
                variant={vista === 'mapa' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5 rounded-l-none border-l border-border/70"
                onClick={() => setVista('mapa')}
              >
                <MapPin className="h-3.5 w-3.5" />
                Mapa
              </Button>
            </div>
            <Button size="sm" onClick={abrirNovo} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Adicionar CNPJ
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <KPIGrid columns={5}>
          <KPICard label="Na lista" value={isLoading ? '—' : kpis.total} icon={Users} />
          <KPICard
            label="Classe A"
            value={isLoading ? '—' : kpis.alta}
            icon={Flame}
            variant="primary"
            subtitle="topo do volume da própria UF"
          />
          <KPICard
            label="Já na carteira"
            value={isLoading ? '—' : kpis.naCarteira}
            icon={Star}
            subtitle="dá para acompanhar faturamento"
          />
          <KPICard
            label="Fora da carteira"
            value={isLoading ? '—' : kpis.fora}
            icon={Users}
            subtitle="alvo territorial, ainda não atendido"
          />
          <KPICard
            label="Praças"
            value={isLoading ? '—' : kpis.praças}
            icon={MapPin}
            subtitle="cidades distintas"
          />
        </KPIGrid>
      </div>

      {/*
        Mesma régua das outras telas: a busca ocupa o dobro dos selects (é o
        filtro que se usa mais), altura h-9 e InputGroup como em /clientes.
      */}
      <FilterBar gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_6.5rem_minmax(0,1fr)_10.5rem_10.5rem]">
        <FilterField label="Buscar PDV, cidade ou CNPJ" className="min-w-0">
          <InputGroup className="h-9">
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPagina(1)
              }}
              placeholder="Nome, cidade ou CNPJ…"
            />
          </InputGroup>
        </FilterField>
        <FilterField label="UF">
          <Select value={uf} onValueChange={mudarUf}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {ufs.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        {/* 459 praças no total — a lista só fica utilizável recortada por UF. */}
        <FilterField label="Cidade" className="min-w-0">
          <Select
            value={cidade}
            onValueChange={comReset<string>(setCidade, 'todas')}
            disabled={uf === 'todas'}
          >
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue placeholder="Escolha a UF primeiro">
                {cidade === 'todas' ? (uf === 'todas' ? 'Escolha a UF' : 'Todas') : cidade}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {cidades.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Situação">
          <Select value={situacao} onValueChange={comReset<Situacao>(setSituacao, 'todas')}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="na_carteira">Já na carteira</SelectItem>
              <SelectItem value="fora">Fora da carteira</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Prioridade">
          <Select value={prioridadeFiltro} onValueChange={comReset<string>(setPrioridadeFiltro, 'todas')}>
            <SelectTrigger className="h-9 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.classe} · {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </FilterBar>

      {filtrosAtivos > 0 && (
        <div className="-mt-4 mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">
              {filtradas.length.toLocaleString('pt-BR')}
            </span>{' '}
            de {linhas.length.toLocaleString('pt-BR')} CNPJs
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Comando da fila de geo: só admin, e só enquanto houver o que resolver. */}
      {isAdmin && <ClientesEstrategicosGeoCard />}

      {vista === 'mapa' && !isLoading ? (
        <ClientesEstrategicosMapa linhas={filtradas} />
      ) : isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtradas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {linhas.length === 0
                ? 'A lista estratégica está vazia — adicione o primeiro CNPJ.'
                : 'Nenhum CNPJ para os filtros selecionados.'}
            </p>
            {linhas.length === 0 && (
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={abrirNovo}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar CNPJ
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
                  {/* CNPJ é a chave da lista e o que o utilizador confere
                      primeiro — coluna própria, antes do nome. */}
                  <TableHead className="w-[170px]">CNPJ</TableHead>
                  <TableHead className="min-w-[200px]">PDV</TableHead>
                  <TableHead>Praça</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead className="min-w-[180px]">Observação</TableHead>
                  <TableHead className="w-[80px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="tabular-nums text-xs">{formatCnpj(l.cnpj)}</TableCell>
                    <TableCell>
                      {l.cliente_id ? (
                        <Link
                          to={`/clientes/${l.cliente_id}`}
                          className="font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {l.nome_exibicao || '—'}
                        </Link>
                      ) : l.nome_exibicao ? (
                        <span className="font-medium text-foreground">{l.nome_exibicao}</span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          sem nome em fonte pública
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.cidade_exibicao ? `${l.cidade_exibicao}/${l.estado_exibicao}` : '—'}
                    </TableCell>
                    <TableCell>
                      {l.na_carteira ? (
                        <Badge variant="success">Na carteira</Badge>
                      ) : (
                        <Badge variant="secondary">Fora</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORIDADE_VARIANT[l.prioridade] ?? 'secondary'}>
                        {PRIORIDADE_CLASSE[l.prioridade]} · {PRIORIDADE_LABELS[l.prioridade]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.observacao || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEmEdicao(l)
                            setDialogAberto(true)
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemover(l)}
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
            <PaginationBar
              page={paginaSegura}
              pageSize={porPagina}
              total={filtradas.length}
              onPageChange={setPagina}
              onPageSizeChange={(s) => {
                setPorPagina(s)
                setPagina(1)
              }}
              className="border-t border-border/60 px-3 py-2"
            />
          </CardContent>
        </Card>
      )}

      {/* Montado só quando aberto: o estado do formulário nasce dos props. */}
      {dialogAberto && (
        <ClienteEstrategicoDialog
          open={dialogAberto}
          onOpenChange={setDialogAberto}
          registro={emEdicao}
        />
      )}
    </div>
  )
}
