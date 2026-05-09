import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Download, Loader2, Upload } from 'lucide-react'
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
import {
  useInsightsProdutoDePara,
  useUpsertInsightsProdutoDePara,
} from '@/hooks/useInsightsProdutoDePara'
import { useProdutos } from '@/hooks/useProdutos'
import {
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
    const o = r.codigo_cliente.trim()
    if (!o) continue
    m.set(o, r.sku_fornecedor.trim())
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

  const { data: existentes, isLoading: loadingMap } = useInsightsProdutoDePara()
  const { data: produtos } = useProdutos()
  const upsert = useUpsertInsightsProdutoDePara()

  const skuValidos = useMemo(() => {
    const s = new Set<string>()
    for (const p of produtos ?? []) {
      s.add(p.sku.trim())
    }
    return s
  }, [produtos])

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
        raw = parseDeParaCsv(await file.text())
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        raw = parseDeParaXlsx(await file.arrayBuffer())
      } else {
        setParseError('Use arquivo .csv, .xlsx ou .xls')
        return
      }
      if (raw.length === 0) {
        setParseError(
          'Nenhuma linha válida. Use colunas codigo_origem ou codprod_fornecedor (esquerda) e sku_fornecedor (direita), ou abra o template.'
        )
        return
      }
      setPreview(dedupeByOrigem(raw))
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
    if (preview.length === 0) return
    try {
      await upsert.mutateAsync({ rows: preview })
      setPreview([])
      setFileName(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao gravar')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="De-para Insights → fábrica"
        description="Mapa único AlwaysOn: código da base territorial (tipicamente coluna codprod_fornecedor no export GA) para o SKU oficial em alwayson_produtos. Usado para comparativos territorial vs cadastro Vinícola."
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <SectionTitle title="Upload do mapeamento" icon={Upload} />
          <p className="text-xs text-muted-foreground max-w-2xl">
            Colunas aceitas na primeira linha (detecção automática):{' '}
            <code className="text-foreground">codigo_origem</code>,{' '}
            <code className="text-foreground">codprod_fornecedor</code> ou{' '}
            <code className="text-foreground">codigo_insights</code> → alinhamento ao mesmo papel de{' '}
            <code>codigo_cliente</code> nos templates distribuidores; e{' '}
            <code className="text-foreground">sku_fornecedor</code> igual ao cadastro de produtos. Aba{' '}
            <strong>De_Para</strong> em .xlsx é detectada quando existir.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={templateHref}
              download
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex gap-1.5')}
            >
              <Download className="w-3.5 h-3.5" />
              Baixar template Insights
            </a>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
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
                Pré-visualização: <strong>{preview.length}</strong> entradas únicas por{' '}
                <code>codigo_origem</code>
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
                disabled={upsert.isPending}
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
                      <TableHead className="text-xs">codigo_origem</TableHead>
                      <TableHead className="text-xs">sku_fornecedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 40).map((r) => (
                      <TableRow key={r.codigo_origem}>
                        <TableCell className="text-xs font-mono">{r.codigo_origem}</TableCell>
                        <TableCell className="text-xs font-mono">{r.sku_fornecedor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.length > 40 && (
                  <p className="text-[11px] text-muted-foreground p-2 border-t">
                    … e mais {preview.length - 40} linhas
                  </p>
                )}
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
              Nenhum de-para Insights ainda — importe pelo upload acima ou aplique a migration{' '}
              <code className="text-foreground">011_insights_produto_de_para.sql</code> no Supabase.
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
            De-para por distribuidor
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
