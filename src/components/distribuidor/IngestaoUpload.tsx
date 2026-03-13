import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react'
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

const EXTENSOES_ACEITAS = '.xlsx,.xls,.csv'
const TAMANHO_MAX_MB = 10

interface IngestaoUploadProps {
  onSuccess?: () => void
  onError?: (message: string) => void
  className?: string
}

export function IngestaoUpload({
  onSuccess,
  onError,
  className,
}: IngestaoUploadProps) {
  const [tipo, setTipo] = useState<string>('vendas')
  const [distribuidorId, setDistribuidorId] = useState<string>('')
  const [periodoReferencia, setPeriodoReferencia] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'success' | 'error' | null
  >(null)
  const [uploadMessage, setUploadMessage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: distribuidores } = useDistribuidores()
  const queryClient = useQueryClient()

  const ingestApiUrl = import.meta.env.VITE_INGEST_API_URL

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const ext = selected.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      onError?.('Formato inválido. Use .xlsx, .xls ou .csv')
      return
    }

    if (selected.size > TAMANHO_MAX_MB * 1024 * 1024) {
      onError?.(`Arquivo muito grande. Máximo ${TAMANHO_MAX_MB}MB`)
      return
    }

    setFile(selected)
    setUploadStatus(null)
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

  return (
    <Card
      className={cn(
        'rounded-md border border-border/50 shadow-none hover:border-border/80 transition-colors',
        className
      )}
    >
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Tipo de Relatório
              </label>
              <Select value={tipo} onValueChange={(v) => setTipo(v ?? 'vendas')}>
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
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
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
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
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
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Arquivo
            </label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept={EXTENSOES_ACEITAS}
                onChange={handleFileChange}
                className="h-8 text-xs file:mr-2 file:rounded-sm file:border-0 file:bg-primary file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-primary-foreground file:cursor-pointer"
              />
              {file && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {file.name}
                </span>
              )}
            </div>
          </div>

          {uploadStatus && (
            <div
              className={cn(
                'flex items-center gap-2 py-2 px-2 rounded-md text-xs',
                uploadStatus === 'success' && 'bg-emerald-50 text-emerald-700',
                uploadStatus === 'error' && 'bg-red-50 text-red-700'
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
        </form>
      </CardContent>
    </Card>
  )
}
