import { useState } from 'react'
import { Link2, Loader2, Trash2, Unlink } from 'lucide-react'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { normalizeDeParaCellValue } from '@/lib/parseDeParaProdutoUpload'
import { useProdutos } from '@/hooks/useProdutos'
import {
  useFaturamentoProdutoDePara,
  useFaturamentoProdutosNaoMapeados,
  useUpsertFaturamentoProdutoDePara,
  useDeleteFaturamentoProdutoDePara,
} from '@/hooks/useFaturamentoProdutoDePara'

export function AdminProdutosCuradoria() {
  const { data: naoMapeados = [], isPending: loadingNaoMap } = useFaturamentoProdutosNaoMapeados()
  const { data: mapeados = [], isPending: loadingMapeados } = useFaturamentoProdutoDePara()
  const { data: produtos, isPending: loadingProdutos } = useProdutos()
  const upsert = useUpsertFaturamentoProdutoDePara()
  const remover = useDeleteFaturamentoProdutoDePara()

  const [skuDraft, setSkuDraft] = useState<Record<string, string>>({})
  const [linkingOrigem, setLinkingOrigem] = useState<string | null>(null)
  const [removendoOrigem, setRemovendoOrigem] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkNotice, setLinkNotice] = useState<string | null>(null)

  const skuValidos = new Set((produtos ?? []).map((p) => p.sku.trim()).filter(Boolean))
  const produtoBySku = new Map((produtos ?? []).map((p) => [p.sku.trim(), p.descricao]))

  const handleVincular = async (skuOrigem: string) => {
    setLinkError(null)
    setLinkNotice(null)
    const raw = (skuDraft[skuOrigem] ?? '').trim()
    const sku = normalizeDeParaCellValue(raw)
    if (!sku) {
      setLinkError('Informe o SKU do catálogo.')
      return
    }
    if (!skuValidos.has(sku)) {
      setLinkError(`SKU ${sku} não existe em Produtos.`)
      return
    }
    setLinkingOrigem(skuOrigem)
    try {
      await upsert.mutateAsync({ sku_origem: skuOrigem, sku_fornecedor: sku })
      setSkuDraft((prev) => {
        const next = { ...prev }
        delete next[skuOrigem]
        return next
      })
      setLinkNotice(`Vinculado ${skuOrigem} → ${sku}.`)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao vincular')
    } finally {
      setLinkingOrigem(null)
    }
  }

  const handleRemover = async (skuOrigem: string) => {
    if (!confirm(`Remover o vínculo de "${skuOrigem}"? Ele volta para a fila de pendentes.`)) return
    setRemovendoOrigem(skuOrigem)
    try {
      await remover.mutateAsync(skuOrigem)
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Falha ao remover')
    } finally {
      setRemovendoOrigem(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle title="SKUs não mapeados (catálogo global)" icon={Unlink} />
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                SKU já resolvido para o formato do fornecedor mas ainda ausente do catálogo —
                vincule a um SKU já cadastrado para entrar na aba Produtos da Performance com
                nome legível. Diferente da fila por distribuidor em Correlação de Produtos, que
                resolve códigos brutos específicos de cada distribuidor — os dois mecanismos não
                se substituem.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {naoMapeados.length.toLocaleString('pt-BR')} SKUs
            </Badge>
          </div>

          {linkError && <p className="text-xs text-destructive">{linkError}</p>}
          {linkNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{linkNotice}</p>
          )}

          {loadingNaoMap ? (
            <Skeleton className="mt-2 h-32 w-full" />
          ) : naoMapeados.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Nenhum SKU pendente — todo o faturamento resolve para o catálogo.
            </p>
          ) : (
            <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">SKU</TableHead>
                    <TableHead className="hidden text-xs md:table-cell">Descrição</TableHead>
                    <TableHead className="text-right text-xs">Faturamento</TableHead>
                    <TableHead className="min-w-[220px] text-xs">SKU do catálogo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {naoMapeados.map((r) => {
                    const draft = skuDraft[r.sku] ?? ''
                    const draftNorm = normalizeDeParaCellValue(draft)
                    const ok = draftNorm ? skuValidos.has(draftNorm) : false
                    const busy = linkingOrigem === r.sku || upsert.isPending
                    return (
                      <TableRow key={r.sku}>
                        <TableCell className="py-2 align-top font-mono text-xs font-medium">
                          {r.sku}
                        </TableCell>
                        <TableCell className="hidden max-w-[220px] truncate py-2 align-top text-xs text-muted-foreground md:table-cell">
                          {r.descricao || '—'}
                        </TableCell>
                        <TableCell className="py-2 text-right align-top text-xs tabular-nums">
                          {formatCurrency(r.faturamento_total)}
                          <p className="text-[10px] text-muted-foreground">
                            {r.total_linhas.toLocaleString('pt-BR')} linhas
                          </p>
                        </TableCell>
                        <TableCell className="py-2 align-top">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <Input
                                value={draft}
                                onChange={(e) =>
                                  setSkuDraft((prev) => ({ ...prev, [r.sku]: e.target.value }))
                                }
                                placeholder="ex. 11.5004"
                                className="h-8 font-mono text-xs"
                                list="curadoria-sku-catalogo-list"
                              />
                              {draftNorm && (
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    className={cn(
                                      'mt-0.5 block w-full truncate text-left text-[10px]',
                                      ok
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-amber-700'
                                    )}
                                  >
                                    {ok
                                      ? produtoBySku.get(draftNorm) || 'No catálogo'
                                      : 'SKU ausente no catálogo'}
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm p-2 text-left">
                                    <p className="text-xs leading-relaxed">
                                      {ok
                                        ? produtoBySku.get(draftNorm) || `SKU ${draftNorm} no catálogo`
                                        : `SKU ${draftNorm} não existe em Produtos`}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!ok || busy || loadingProdutos}
                              onClick={() => void handleVincular(r.sku)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
                              aria-label="Vincular"
                              title="Vincular"
                            >
                              {busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <datalist id="curadoria-sku-catalogo-list">
            {(produtos ?? []).slice(0, 800).map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.descricao}
              </option>
            ))}
          </datalist>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionTitle title="Mapeamentos cadastrados" icon={Link2} />
          {loadingMapeados ? (
            <Skeleton className="mt-2 h-24 w-full" />
          ) : mapeados.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum vínculo gravado ainda.
            </p>
          ) : (
            <div className="mt-2 max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">SKU origem</TableHead>
                    <TableHead className="text-xs">SKU catálogo</TableHead>
                    <TableHead className="text-xs">Criado</TableHead>
                    <TableHead className="text-right text-xs">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mapeados.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.sku_origem}</TableCell>
                      <TableCell className="font-mono text-xs">{m.sku_fornecedor}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {new Date(m.criado_em).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          disabled={removendoOrigem === m.sku_origem || remover.isPending}
                          onClick={() => void handleRemover(m.sku_origem)}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remover
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
