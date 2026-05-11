import { useCallback, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useDistribuidores } from '@/hooks/useDistribuidores'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

const TIPOS_RELATORIO = [
  { value: 'vendas', label: 'Vendas (sell-out)' },
  { value: 'estoque', label: 'Estoque' },
  { value: 'clientes', label: 'Clientes' },
] as const

type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]['value']

const EXTENSOES_ACEITAS = '.xlsx,.xls,.csv'
const EXTENSOES_VALIDAS = ['xlsx', 'xls', 'csv'] as const
const TAMANHO_MAX_MB = 10

const templateHref = (file: string) =>
  `${import.meta.env.BASE_URL}templates/${file}`.replace(/\/+/g, '/')

const TEMPLATE_MAP: Record<TipoRelatorio, string> = {
  vendas: templateHref('template-vendas.xlsx'),
  estoque: templateHref('template-estoque.xlsx'),
  clientes: templateHref('template-clientes.xlsx'),
}

/** Colunas esperadas por tipo de relatório (hint para o usuário, não validação). */
const COLUNAS_ESPERADAS: Record<TipoRelatorio, string[]> = {
  vendas: ['data', 'cnpj_cliente', 'sku', 'quantidade', 'valor_total'],
  estoque: ['sku', 'descricao', 'quantidade', 'est_minimo', 'dias_cobertura'],
  clientes: ['cnpj', 'razao_social', 'nome_fantasia', 'cidade', 'estado'],
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface IngestaoUploadProps {
  onSuccess?: () => void
  onError?: (message: string) => void
  className?: string
}

export function IngestaoUpload({ onSuccess, onError, className }: IngestaoUploadProps) {
  const [tipo, setTipo] = useState<TipoRelatorio>('vendas')
  const [distribuidorId, setDistribuidorId] = useState<string>('')
  const [periodoReferencia, setPeriodoReferencia] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error' | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: distribuidores } = useDistribuidores()
  const queryClient = useQueryClient()

  const ingestApiUrl = import.meta.env.VITE_INGEST_API_URL

  const setFileSafe = useCallback(
    (selected: File | null) => {
      if (!selected) {
        setFile(null)
        return
      }
      const ext = selected.name.split('.').pop()?.toLowerCase() ?? ''
      if (!(EXTENSOES_VALIDAS as readonly string[]).includes(ext)) {
        const msg = 'Formato inválido. Use .xlsx, .xls ou .csv'
        setUploadStatus('error')
        setUploadMessage(msg)
        onError?.(msg)
        return
      }
      if (selected.size > TAMANHO_MAX_MB * 1024 * 1024) {
        const msg = `Arquivo muito grande. Máximo ${TAMANHO_MAX_MB}MB`
        setUploadStatus('error')
        setUploadMessage(msg)
        onError?.(msg)
        return
      }
      setFile(selected)
      setUploadStatus(null)
      setUploadMessage('')
    },
    [onError]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileSafe(e.target.files?.[0] ?? null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFileSafe(dropped)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !distribuidorId || !periodoReferencia || !ingestApiUrl) {
      setUploadStatus('error')
      setUploadMessage(
        !ingestApiUrl
          ? 'API de ingestão não configurada (VITE_INGEST_API_URL)'
          : 'Preencha todos os campos e selecione um arquivo'
      )
      return
    }

    setIsUploading(true)
    setUploadStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('tipo', tipo)
      formData.append('distribuidor_id', distribuidorId)
      formData.append('periodo_referencia', periodoReferencia)

      const res = await fetch(`${ingestApiUrl.replace(/\/$/, '')}/api/ingest`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `Erro ${res.status}`)
      }

      setUploadStatus('success')
      setUploadMessage(
        data.registros_processados != null
          ? `${data.registros_processados} registros processados`
          : 'Arquivo enviado. Processamento em andamento.'
      )
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      queryClient.invalidateQueries({ queryKey: ['relatorios-ingestao'] })
      queryClient.invalidateQueries({ queryKey: ['relatorios-pendentes'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })

      onSuccess?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo'
      setUploadStatus('error')
      setUploadMessage(msg)
      onError?.(msg)
    } finally {
      setIsUploading(false)
    }
  }

  const hoje = new Date().toISOString().split('T')[0]
  const colunasEsperadas = COLUNAS_ESPERADAS[tipo]

  return (
    <Card className={cn('hover:shadow-card-hover transition-shadow', className)}>
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Tipo de Relatório
              </label>
              <Select value={tipo} onValueChange={(v) => setTipo((v as TipoRelatorio) ?? 'vendas')}>
                <SelectTrigger className="h-8 w-full text-xs shadow-none border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_RELATORIO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Distribuidor
              </label>
              <Select value={distribuidorId} onValueChange={(v) => setDistribuidorId(v ?? '')}>
                <SelectTrigger className="h-8 w-full text-xs shadow-none border-border/50">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(distribuidores ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Período Referência
              </label>
              <Input
                type="date"
                value={periodoReferencia}
                onChange={(e) => setPeriodoReferencia(e.target.value)}
                max={hoje}
                className="h-8 text-xs shadow-none border-border/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Arquivo
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept={EXTENSOES_ACEITAS}
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={() => {
                    setFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  aria-label="Remover arquivo"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'w-full flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 transition-colors cursor-pointer',
                  isDragging
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border/60 hover:border-border hover:bg-muted/20'
                )}
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
                <p className="text-xs text-foreground font-medium">
                  Arraste o arquivo ou clique para selecionar
                </p>
                <p className="text-[11px] text-muted-foreground">
                  .xlsx · .xls · .csv · máx {TAMANHO_MAX_MB}MB
                </p>
              </button>
            )}

            {colunasEsperadas && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Colunas esperadas
                </span>
                {colunasEsperadas.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center rounded border border-border/60 bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                  >
                    {col}
                  </span>
                ))}
              </div>
            )}
          </div>

          {uploadStatus && (
            <div
              className={cn(
                'flex items-center gap-2 py-2 px-2 rounded-md text-xs',
                uploadStatus === 'success' && 'bg-success/10 text-success',
                uploadStatus === 'error' && 'bg-destructive/10 text-destructive'
              )}
            >
              {uploadStatus === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{uploadMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={isUploading || !file}
              className="h-8 text-xs shadow-none border-border/50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Relatório
                </>
              )}
            </Button>
            <a
              href={TEMPLATE_MAP[tipo]}
              download
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted hover:text-foreground transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar Template
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
