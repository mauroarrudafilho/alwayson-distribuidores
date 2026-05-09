import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Download, Loader2, Upload } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { SectionTitle } from '@/components/distribuidor/SectionTitle'
import { FilterBar, FilterField } from '@/components/distribuidor/FilterBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useDistribuidores } from '@/hooks/useDistribuidores'
import {
  useDistribuidorProdutoDePara,
  useUpsertDistribuidorProdutoDePara,
} from '@/hooks/useDistribuidorProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import {
  parseDeParaCsv,
  parseDeParaXlsx,
} from '@/lib/parseDeParaProdutoUpload'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const templateHref = `${import.meta.env.BASE_URL}templates/template-de-para-produtos.xlsx`.replace(
  /\/+/g,
  '/'
)

function dedupeRows(
  rows: Array<{ codigo_cliente: string; sku_fornecedor: string }>
) {
  const m = new Map<string, string>()
  for (const r of rows) {
    m.set(r.codigo_cliente, r.sku_fornecedor)
  }
  return [...m.entries()].map(([codigo_cliente, sku_fornecedor]) => ({
    codigo_cliente,
    sku_fornecedor,
  }))
}

export function AdminDeParaProdutos() {
  const fileRef = useRef<HTMLInputElement>(null)
  const { distribuidorId: routeDistribuidorId } = useParams<{ distribuidorId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const did =
    (routeDistribuidorId && routeDistribuidorId.length > 0
      ? routeDistribuidorId
      : searchParams.get('distribuidor')) ?? ''
  const scopedToRoute = Boolean(routeDistribuidorId)
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<
    Array<{ codigo_cliente: string; sku_fornecedor: string }>
  >([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const { data: distribuidores, isLoading: loadingDist } = useDistribuidores()
  const { data: existentes, isLoading: loadingMap } = useDistribuidorProdutoDePara(
    did || undefined
  )
  const { data: produtos } = useProdutos()
  const upsert = useUpsertDistribuidorProdutoDePara()

  const skuValidos = useMemo(() => {
    const s = new Set<string>()
    for (const p of produtos ?? []) {
      s.add(p.sku.trim())
    }
    return s
  }, [produtos])

  const onDistribChange = (id: string) => {
    if (scopedToRoute) return
    if (id) setSearchParams({ distribuidor: id })
    else setSearchParams({})
  }

  const onFile = useCallback(async (file: File | null) => {
    setParseError(null)
    setSaveError(null)
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
        const text = await file.text()
        raw = parseDeParaCsv(text)
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer()
        raw = parseDeParaXlsx(buf)
      } else {
        setParseError('Use arquivo .csv, .xlsx ou .xls')
        return
      }
      if (raw.length === 0) {
        setParseError('Nenhuma linha válida encontrada (cabeçalhos codigo_cliente / sku_fornecedor).')
        return
      }
      setPreview(dedupeRows(raw))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Falha ao ler arquivo')
    }
  }, [])

  const skusDesconhecidos = useMemo(() => {
    if (skuValidos.size === 0) return []
    const u = new Set<string>()
    for (const r of preview) {
      if (!skuValidos.has(r.sku_fornecedor)) u.add(r.sku_fornecedor)
    }
    return [...u].sort().slice(0, 50)
  }, [preview, skuValidos])

  const handleGravar = async () => {
    setSaveError(null)
    if (!did || preview.length === 0) return
    try {
      await upsert.mutateAsync({
        distribuidor_id: did,
        rows: preview,
      })
      setPreview([])
      setFileName(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {!scopedToRoute && (
        <PageHeader
          title="Correlação de Produtos (por distribuidor)"
          description="Associe o código de produto que o distribuidor usa em relatórios e metas ao SKU oficial do fornecedor (base alwayson_produtos)."
        />
      )}

      {!scopedToRoute && (
        <FilterBar>
          <FilterField label="Distribuidor">
            <Select
              value={did || undefined}
              onValueChange={(v) => onDistribChange(v ?? '')}
              disabled={loadingDist}
            >
              <SelectTrigger className="h-8 text-sm w-[min(100%,280px)]">
                <SelectValue placeholder="Selecione o distribuidor" />
              </SelectTrigger>
              <SelectContent>
                {(distribuidores ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </FilterBar>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <SectionTitle title="Upload do mapeamento" icon={Upload} />
          <p className="text-xs text-muted-foreground max-w-2xl">
            Colunas esperadas: <code className="text-foreground">codigo_cliente</code> ({' '}
            código interno do cliente) e{' '}
            <code className="text-foreground">sku_fornecedor</code> (igual ao cadastro oficial, ex.
            coluna Código da base Vinícola Campestre). Planilhas com aba{' '}
            <strong>De_Para</strong> são detectadas automaticamente.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={templateHref}
              download
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex gap-1.5')}
            >
              <Download className="w-3.5 h-3.5" />
              Baixar template
            </a>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              disabled={!did}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              disabled={!did}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-3.5 h-3.5" />
              Escolher arquivo
            </Button>
            {fileName && (
              <span className="text-xs text-muted-foreground">{fileName}</span>
            )}
          </div>
          {parseError && (
            <p className="text-xs text-destructive">{parseError}</p>
          )}
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Pré-visualização: <strong>{preview.length}</strong> mapeamentos únicos por{' '}
                <code>codigo_cliente</code>
              </p>
              {skusDesconhecidos.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  SKUs ainda não cadastrados em Produtos (amostra):{' '}
                  {skusDesconhecidos.join(', ')}
                  {(preview.some((r) => !skuValidos.has(r.sku_fornecedor)) &&
                    skusDesconhecidos.length === 50 &&
                    ' …') ||
                    ''}
                </p>
              )}
              <Button
                size="sm"
                disabled={!did || upsert.isPending}
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
              <div className="border rounded-md max-h-56 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">codigo_cliente</TableHead>
                      <TableHead className="text-xs">sku_fornecedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 30).map((r) => (
                      <TableRow key={r.codigo_cliente}>
                        <TableCell className="text-xs font-mono">{r.codigo_cliente}</TableCell>
                        <TableCell className="text-xs font-mono">{r.sku_fornecedor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 30 && (
                  <p className="text-[11px] text-muted-foreground p-2 border-t">
                    … e mais {preview.length - 30} linhas
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {did && (
        <Card>
          <CardContent className="p-4">
            <SectionTitle title="Mapeamentos já cadastrados" icon={ArrowRight} />
            {loadingMap ? (
              <Skeleton className="h-32 w-full mt-2" />
            ) : !existentes || existentes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhuma correlação cadastrada para este distribuidor
              </p>
            ) : (
              <div className="border rounded-md max-h-72 overflow-auto mt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">codigo_cliente</TableHead>
                      <TableHead className="text-xs">sku_fornecedor</TableHead>
                      <TableHead className="text-xs">Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {existentes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono">{r.codigo_cliente}</TableCell>
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
      )}

      <p className="text-[11px] text-muted-foreground">
        {scopedToRoute ? (
          <>
            <Link
              to={`/admin/distribuidores/${routeDistribuidorId}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Voltar ao resumo do distribuidor
            </Link>
          </>
        ) : (
          <>
            Voltar para{' '}
            <Link
              to="/admin/distribuidores"
              className="text-primary underline-offset-2 hover:underline"
            >
              Distribuidores
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
