import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  useInsightsProdutoDePara,
  useUpsertInsightsProdutoDePara,
} from '@/hooks/useInsightsProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import {
  normalizeDeParaCellValue,
  parseDeParaCsv,
  parseDeParaXlsx,
} from '@/lib/parseDeParaProdutoUpload'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const templateHref = `${import.meta.env.BASE_URL}templates/template-de-para-insights-produtos.xlsx`.replace(
  /\/+/g,
  '/'
)

function dedupeByOrigem(
  rows: Array<{ codigo_cliente: string; sku_fornecedor: string }>
): Array<{ codigo_origem: string; sku_fornecedor: string }> {
  const m = new Map<string, string>()
  for (const r of rows) {
    const o = normalizeDeParaCellValue(r.codigo_cliente)
    if (!o) continue
    m.set(o, normalizeDeParaCellValue(r.sku_fornecedor))
  }
  return [...m.entries()].map(([codigo_origem, sku_fornecedor]) => ({
    codigo_origem,
    sku_fornecedor,
  }))
}

export function AdminInsightsDeParaProdutos() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<
    Array<{ codigo_origem: string; sku_fornecedor: string }>
  >([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const { data: existentes, isLoading: loadingMap } = useInsightsProdutoDePara()
  const { data: produtos, isPending: loadingProdutos } = useProdutos()
  const upsert = useUpsertInsightsProdutoDePara()

  const skuValidos = useMemo(() => {
    const s = new Set<string>()
    for (const p of produtos ?? []) {
      const k = p.sku.trim()
      if (!k) continue
      s.add(k)
      const n = normalizeDeParaCellValue(k)
      if (n && n !== k) s.add(n)
    }
    return s
  }, [produtos])

  const produtoBySkuNorm = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of produtos ?? []) {
      const k = p.sku.trim()
      if (!k) continue
      m.set(k, p.descricao)
      const n = normalizeDeParaCellValue(k)
      if (n) m.set(n, p.descricao)
    }
    return m
  }, [produtos])

  const origemJaNoServidor = useMemo(() => {
    return new Set((existentes ?? []).map((e) => e.codigo_origem.trim()))
  }, [existentes])

  const onFile = useCallback(async (file: File | null) => {
    setParseError(null)
    setSaveError(null)
    setSaveNotice(null)
    setPreview([])
    if (!file) {
      setFileName(null)
      return
    }
    setFileName(file.name)
    try {
      const lower = file.name.toLowerCase()
      let raw: Array<{ codigo_cliente: string; sku_fornecedor: string }>
      if (lower.endsWith('.csv')) {
        raw = parseDeParaCsv(await file.text())
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        raw = parseDeParaXlsx(await file.arrayBuffer())
      } else {
        setParseError('Use arquivo .csv, .xlsx ou .xls')
        return
      }
      if (raw.length === 0) {
        setParseError('Nenhuma linha válida no arquivo (precisa cabeçalho e pares código → SKU).')
        return
      }
      setPreview(dedupeByOrigem(raw))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Falha ao ler arquivo')
    }
  }, [])

  const previewLinhas = useMemo(() => {
    return preview
      .map((r) => {
        const skuN = normalizeDeParaCellValue(r.sku_fornecedor)
        const okCatalogo = skuValidos.has(skuN)
        return {
          ...r,
          skuNorm: skuN,
          okCatalogo,
          descricaoCadastro: okCatalogo ? produtoBySkuNorm.get(skuN) ?? '' : '',
          jaNoMapa: origemJaNoServidor.has(r.codigo_origem.trim()),
        }
      })
      .sort((a, b) => {
        if (a.okCatalogo !== b.okCatalogo) return a.okCatalogo ? -1 : 1
        return a.codigo_origem.localeCompare(b.codigo_origem, undefined, { numeric: true })
      })
  }, [preview, skuValidos, produtoBySkuNorm, origemJaNoServidor])

  const contagem = useMemo(() => {
    const ok = previewLinhas.filter((x) => x.okCatalogo).length
    const bad = previewLinhas.length - ok
    return { ok, bad, total: previewLinhas.length }
  }, [previewLinhas])

  const skuEstaNoCatalogo = (sku: string) => skuValidos.has(normalizeDeParaCellValue(sku))

  const handleGravar = async () => {
    setSaveError(null)
    setSaveNotice(null)
    if (preview.length === 0) return
    if (loadingProdutos || skuValidos.size === 0) {
      setSaveError('Aguarde o carregamento da lista de produtos ou verifique a conexão.')
      return
    }
    const validRows = preview.filter((r) => skuEstaNoCatalogo(r.sku_fornecedor))
    const skipped = preview.length - validRows.length
    if (validRows.length === 0) {
      setSaveError(
        'Nenhuma linha pode ser gravada: todo sku_fornecedor precisa existir em Produtos.'
      )
      return
    }
    try {
      await upsert.mutateAsync({ rows: validRows })
      if (skipped > 0) {
        setSaveNotice(
          `Gravados ${validRows.length} mapeamento(s). ${skipped} linha(s) com SKU inexistente no cadastro permanecem na lista abaixo.`
        )
        setPreview(preview.filter((r) => !skuEstaNoCatalogo(r.sku_fornecedor)))
      } else {
        setPreview([])
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Erro ao gravar'
      setSaveError(
        /foreign key|23503/i.test(msg)
          ? `${msg} — Confira se cada sku_fornecedor existe em Produtos.`
          : msg
      )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Correlação de Produtos (Insights → fábrica)"
        description="Códigos da base territorial → SKU oficial em alwayson_produtos. Um mapa único para padronizar Insights."
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Importar mapeamento" icon={Upload} />
            <a
              href={templateHref}
              download
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'inline-flex gap-1.5 text-xs')}
            >
              <Download className="w-3.5 h-3.5" />
              Template .xlsx
            </a>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />

          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void onFile(f)
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/45 hover:bg-muted/30'
            )}
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">
              Solte o arquivo aqui ou clique para escolher
            </p>
            <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx ou .xls</p>
            {fileName && (
              <p className="text-xs font-mono text-primary mt-3">{fileName}</p>
            )}
          </div>

          <details className="text-xs text-muted-foreground max-w-2xl">
            <summary className="cursor-pointer select-none text-foreground/80 hover:text-foreground">
              Colunas esperadas no arquivo
            </summary>
            <p className="mt-2 leading-relaxed">
              Esquerda: <code className="text-foreground">codigo_origem</code>,{' '}
              <code className="text-foreground">codprod_fornecedor</code> ou{' '}
              <code className="text-foreground">codigo_insights</code>. Direita:{' '}
              <code className="text-foreground">sku_fornecedor</code> (igual ao cadastro de produtos).
              Aba De_Para no Excel é usada se existir. Números no padrão Campestre (ex.{' '}
              <code className="text-foreground">117004</code> → <code className="text-foreground">11.7004</code>)
              são normalizados automaticamente.
            </p>
          </details>

          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
          {saveNotice && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400">{saveNotice}</p>
          )}

          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  <strong>{contagem.total}</strong> linhas ·{' '}
                  <span className="text-emerald-700 dark:text-emerald-600">{contagem.ok}</span> com SKU
                  no catálogo ·{' '}
                  <span className="text-amber-700 dark:text-amber-500">{contagem.bad}</span> SKU alvo
                  ausente
                </span>
              </div>

              {preview.length > 0 && !loadingProdutos && skuValidos.size === 0 && (
                <p className="text-xs text-destructive">
                  Lista de produtos vazia ou não carregou — não é possível validar SKUs.
                </p>
              )}

              <Button
                size="sm"
                disabled={
                  upsert.isPending || loadingProdutos || skuValidos.size === 0 || preview.length === 0
                }
                onClick={() => void handleGravar()}
              >
                {upsert.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Gravando…
                  </>
                ) : (
                  'Gravar no Supabase'
                )}
              </Button>

              <div className="border rounded-md max-h-[min(28rem,55vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-[110px]">Status</TableHead>
                      <TableHead className="text-xs">codigo_origem</TableHead>
                      <TableHead className="text-xs">sku_fornecedor</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Produto (cadastro)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLinhas.map((r) => (
                      <TableRow key={r.codigo_origem}>
                        <TableCell className="align-top py-2">
                          {!r.okCatalogo ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-amber-600/50 text-amber-800 dark:text-amber-400"
                            >
                              SKU não cadastrado
                            </Badge>
                          ) : r.jaNoMapa ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Catálogo OK · mapa existente
                            </Badge>
                          ) : (
                            <Badge className="text-[10px]">Catálogo OK · novo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono align-top py-2">{r.codigo_origem}</TableCell>
                        <TableCell className="text-xs font-mono align-top py-2">{r.skuNorm}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate align-top py-2 hidden md:table-cell">
                          {r.descricaoCadastro || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <SectionTitle title="Mapeamentos cadastrados" icon={ArrowRight} />
          {loadingMap ? (
            <Skeleton className="h-32 w-full mt-2" />
          ) : !existentes || existentes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Nenhum mapeamento gravado ainda — importe acima (ou migration{' '}
              <code className="text-foreground">011_insights_produto_de_para.sql</code>).
            </p>
          ) : (
            <div className="border rounded-md max-h-72 overflow-auto mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">codigo_origem</TableHead>
                    <TableHead className="text-xs">sku_fornecedor</TableHead>
                    <TableHead className="text-xs">Atualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existentes.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-mono">{r.codigo_origem}</TableCell>
                      <TableCell className="text-xs font-mono">{r.sku_fornecedor}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {new Date(r.atualizado_em).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span>
          <Link
            to="/admin/distribuidores"
            className="text-primary underline-offset-2 hover:underline"
          >
            Correlação por distribuidor
          </Link>{' '}
          (sell-in / ERP do cliente).
        </span>
        <span>
          <Link to="/insights" className="text-primary underline-offset-2 hover:underline">
            Voltar ao Insights
          </Link>
        </span>
      </div>
    </div>
  )
}
