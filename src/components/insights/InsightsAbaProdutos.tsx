import { useState, useMemo } from 'react'
import { Package, ChevronDown, ChevronRight, Users, MapPin, ShoppingCart, DollarSign } from 'lucide-react'
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
import { formatCurrency } from '@/lib/format'
import { MOCK_PRODUTOS, MOCK_PRODUTO_DETALHE } from '@/hooks/useMockInsights'
import type { InsightsProdutoRow } from '@/types/insights'

function ProdutoRow({
  row,
  maxFat,
}: {
  row: InsightsProdutoRow
  maxFat: number
}) {
  const [open, setOpen] = useState(false)
  const detalhe = MOCK_PRODUTO_DETALHE[row.sku]
  const pct = maxFat > 0 ? (row.faturamento_total / maxFat) * 100 : 0

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(!open)}>
        <TableCell>
          <span className="flex items-center gap-1.5">
            {open ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="font-mono text-xs">{row.sku}</span>
          </span>
        </TableCell>
        <TableCell className="font-medium max-w-[220px] truncate">{row.descricao}</TableCell>
        <TableCell className="hidden sm:table-cell">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.categoria}</Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {formatCurrency(row.faturamento_total)}
        </TableCell>
        <TableCell className="hidden md:table-cell text-right tabular-nums">
          {row.quantidade_total.toLocaleString('pt-BR')}
          <span className="ml-1 text-muted-foreground text-xs">{row.unidade}</span>
        </TableCell>
        <TableCell className="hidden lg:table-cell text-right tabular-nums">{row.total_clientes}</TableCell>
        <TableCell className="hidden lg:table-cell text-right tabular-nums">{row.total_cidades}</TableCell>
        <TableCell className="hidden xl:table-cell w-32">
          <div className="flex-1 h-3 bg-muted/50 rounded overflow-hidden">
            <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="p-0">
            <div className="px-8 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top clientes */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Top Clientes
                </p>
                {detalhe?.topClientes && detalhe.topClientes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead>Cliente</TableHead>
                        <TableHead className="hidden sm:table-cell">Cidade</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhe.topClientes.map((c) => (
                        <TableRow key={c.cnpj_cliente} className="border-border/30">
                          <TableCell className="font-medium text-sm">{c.nome_cliente}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                            {c.cidade}/{c.estado}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {c.quantidade_total.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {formatCurrency(c.faturamento_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">Sem dados de clientes para este SKU.</p>
                )}
              </div>

              {/* Top cidades */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Top Cidades
                </p>
                {detalhe?.topCidades && detalhe.topCidades.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead>Cidade</TableHead>
                        <TableHead className="text-right">Clientes</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalhe.topCidades.map((c) => (
                        <TableRow key={`${c.cidade}-${c.estado}`} className="border-border/30">
                          <TableCell className="font-medium text-sm">
                            {c.cidade} <span className="text-muted-foreground text-xs">/ {c.estado}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">{c.total_clientes}</TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {c.quantidade_total.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm font-medium">
                            {formatCurrency(c.faturamento_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">Sem dados de cidades para este SKU.</p>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function InsightsAbaProdutos() {
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  const categorias = useMemo(
    () => [...new Set(MOCK_PRODUTOS.map((p) => p.categoria))].sort(),
    []
  )

  const produtosFiltrados = useMemo(() => {
    return MOCK_PRODUTOS.filter((p) => {
      const matchBusca =
        busca === '' ||
        p.sku.toLowerCase().includes(busca.toLowerCase()) ||
        p.descricao.toLowerCase().includes(busca.toLowerCase())
      const matchCategoria = categoria === '' || p.categoria === categoria
      return matchBusca && matchCategoria
    })
  }, [busca, categoria])

  const maxFat = Math.max(...MOCK_PRODUTOS.map((p) => p.faturamento_total), 1)

  const totais = useMemo(() => {
    const fat = produtosFiltrados.reduce((s, p) => s + p.faturamento_total, 0)
    const qtd = produtosFiltrados.reduce((s, p) => s + p.quantidade_total, 0)
    const nfs = produtosFiltrados.reduce((s, p) => s + p.total_nfs, 0)
    return { fat, qtd, nfs }
  }, [produtosFiltrados])

  return (
    <div className="mt-0">
      <FilterBar columns={2}>
        <FilterField label="Buscar SKU ou descrição">
          <Input
            placeholder="CAMP-001, Manteiga…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-sm"
          />
        </FilterField>
        <FilterField label="Categoria">
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={categoria === '' ? 'default' : 'outline'}
              className="h-8 text-xs"
              onClick={() => setCategoria('')}
            >
              Todas
            </Button>
            {categorias.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={categoria === c ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => setCategoria(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </FilterField>
      </FilterBar>

      {(busca !== '' || categoria !== '') && (
        <KPIGrid columns={3} className="mb-6">
          <KPICard label="Faturamento (filtro)" value={formatCurrency(totais.fat)} icon={DollarSign} />
          <KPICard label="Quantidade (filtro)"  value={totais.qtd.toLocaleString('pt-BR')} icon={Package} />
          <KPICard label="NFs (filtro)"          value={totais.nfs.toLocaleString('pt-BR')} icon={ShoppingCart} />
        </KPIGrid>
      )}

      <SectionTitle title="Produtos" icon={Package} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="hidden md:table-cell text-right">Qtd Total</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Clientes</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Cidades</TableHead>
                <TableHead className="hidden xl:table-cell">Participação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum produto encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
              {produtosFiltrados.map((row) => (
                <ProdutoRow key={row.sku} row={row} maxFat={maxFat} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
