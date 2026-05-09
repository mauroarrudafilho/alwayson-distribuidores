import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { parseInsightsCnpj } from '@/lib/insightsCnpj'
import { insightsCnpjKey } from '@/hooks/useInsightsQueries'
import {
  insightsClienteBrasilStatusTitle,
  parseInsightsClienteBrasilStatus,
} from '@/lib/insightsClienteBrasilStatus'
import { cn } from '@/lib/utils'
import type { InsightsClienteBrasilStatus } from '@/types/insights'

type InsightClienteDim = {
  cnpj_14: string
  nome_cliente: string | null
  razao_social: string | null
  cidade: string | null
  estado: string | null
  brasil_enriquecimento_status: string | null
  cadastro_ativo: boolean | null
  brasil_api_ultimo_motivo: string | null
}

type CadastroCheck = {
  id: string
  label: string
  ok: boolean
  /** Quando não ok, texto curto para tooltip */
  detalhe?: string
}

function formatCnpjDisplay(d14: string) {
  const d = d14.replace(/\D/g, '').padStart(14, '0').slice(-14)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

function montarChecksCadastroInsights(r: InsightClienteDim): CadastroCheck[] {
  const nomeOk = Boolean(
    (r.nome_cliente ?? '').trim() || (r.razao_social ?? '').trim()
  )
  const localOk =
    Boolean((r.cidade ?? '').trim()) && Boolean((r.estado ?? '').trim())

  const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
  const apiOk = st === 'ready'
  const apiPendente = st === 'pending' || st === 'processing'

  const falhaMotivo =
    st === 'error' || st === 'not_found'
      ? [insightsClienteBrasilStatusTitle(st), r.brasil_api_ultimo_motivo].filter(Boolean).join(' — ')
      : ''

  const ativaOk = apiOk && r.cadastro_ativo !== false

  const checks: CadastroCheck[] = [
    {
      id: 'nome',
      label: 'Identificação (nome)',
      ok: nomeOk,
      detalhe: nomeOk ? undefined : 'Inclua nome ou razão na origem / import',
    },
    {
      id: 'local',
      label: 'Cidade / UF',
      ok: localOk,
      detalhe: localOk ? undefined : 'Preenchido após BrasilAPI ou planilha',
    },
    {
      id: 'brasil',
      label: 'Consulta Receita (BrasilAPI)',
      ok: apiOk,
      detalhe: apiOk
        ? undefined
        : apiPendente
          ? 'Na fila — rode o worker ou aguarde import'
          : st === 'error' || st === 'not_found'
            ? falhaMotivo || 'Falha na consulta'
            : 'Aguardando processamento',
    },
    {
      id: 'ativa',
      label: 'Situação ATIVA',
      ok: ativaOk,
      detalhe: ativaOk
        ? undefined
        : apiOk && r.cadastro_ativo === false
          ? 'CNPJ não ATIVO na Receita'
          : 'Aguardando consulta',
    },
  ]

  return checks
}

function percentualCadastro(checks: CadastroCheck[]) {
  if (!checks.length) return 0
  return Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)
}

function resumoCadastroRow(pct: number, st: InsightsClienteBrasilStatus | undefined) {
  if (pct >= 100) return { label: 'Completo', variant: 'default' as const }
  if (st === 'error' || st === 'not_found')
    return { label: 'Bloqueado', variant: 'destructive' as const }
  return { label: 'Em andamento', variant: 'secondary' as const }
}

function CheckIcon({ ok, pending }: { ok: boolean; pending?: boolean }) {
  if (pending) return <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
  if (ok) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
  return <Circle className="w-3.5 h-3.5 text-muted-foreground/60" />
}

export function AdminInsightsCadastroClientes() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [openCnpj, setOpenCnpj] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState('')

  const list = useQuery({
    queryKey: ['admin', 'insights-clientes-cadastro', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_clientes')
        .select(
          'cnpj_14, nome_cliente, razao_social, cidade, estado, brasil_enriquecimento_status, cadastro_ativo, brasil_api_ultimo_motivo'
        )
        .order('cnpj_14')
      if (error) throw error
      return (data ?? []) as InsightClienteDim[]
    },
  })

  const purge = useMutation({
    mutationFn: async ({ cnpjNorm, confirmacao }: { cnpjNorm: string; confirmacao: string }) => {
      const { data, error } = await supabase.rpc('insights_delete_cliente_e_nfs', {
        p_cnpj_14: cnpjNorm,
        p_secret: confirmacao.trim(),
      })
      if (error) throw error
      const payload = data as { ok?: boolean; error?: string; cnpj_14?: string }
      if (!payload?.ok) {
        const code = payload?.error
        let msg = 'Falha na exclusão'
        if (code === 'forbidden') msg = 'CNPJ digitado não confere com o cliente alvo.'
        else if (code === 'nao_encontrado') msg = 'Cliente não encontrado.'
        else if (code === 'cnpj_invalido') msg = 'CNPJ inválido.'
        else if (typeof code === 'string') msg = code
        throw new Error(msg)
      }
      return payload
    },
    onSuccess: async () => {
      setOpenCnpj(null)
      setConfirmacao('')
      await qc.invalidateQueries({ queryKey: ['admin', 'insights-clientes-cadastro'] })
      await qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  function confirmacaoBateCnpj(input: string, cnpj14: string) {
    const digits = input.replace(/\D/g, '')
    if (digits.length < 14) return false
    return digits.slice(-14) === cnpj14
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const rows = list.data ?? []
    if (!q) return rows
    return rows.filter((r) => {
      const d = insightsCnpjKey(r.cnpj_14).toLowerCase()
      const nom = `${r.nome_cliente ?? ''} ${r.razao_social ?? ''}`.toLowerCase()
      const loc = `${r.cidade ?? ''} ${r.estado ?? ''}`.toLowerCase()
      return d.includes(q) || nom.includes(q) || loc.includes(q) || r.cnpj_14.includes(q)
    })
  }, [busca, list.data])

  const erroRpc = purge.isError
    ? purge.error instanceof Error
      ? purge.error.message
      : String(purge.error ?? '')
    : ''

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Cadastro de clientes Insights"
        description="Acompanhe o preenchimento da dimensão territorial: identificação, local (cidade/UF), consulta Receita Federal (BrasilAPI) e status do CNPJ. A remoção de cliente continua disponível quando precisar corrigir importações antigas."
      />

      <Card>
        <CardContent className="pt-6 space-y-4 text-sm">
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <p>
              Cadastro considerado <strong className="text-foreground">100%</strong> quando os
              quatro itens à direita estão verificados (inclui CNPJ <strong className="text-foreground">ATIVO</strong>{' '}
              na última consulta BrasilAPI). Pendentes de API entram na fila — processar com{' '}
              <code className="text-[11px] font-mono whitespace-nowrap">
                npm run insights:process-clientes
              </code>{' '}
              (service role).
            </p>
          </div>

          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Remover cliente e todas as NFs é irreversível</p>
              <p className="text-muted-foreground dark:text-amber-100/85">
                Use o botão &quot;Remover…&quot; só após revisar o cadastro. Para confirmar, digite
                o CNPJ no diálogo. Totais{' '}
                <code className="text-xs font-mono">total_nfs</code> /{' '}
                <code className="text-xs font-mono">total_itens</code> dos uploads afetados são
                recalculados automaticamente.
              </p>
              <p className="mt-2 text-muted-foreground dark:text-amber-100/85">
                CLI (service role):{' '}
                <code className="text-xs font-mono whitespace-nowrap">
                  npm run insights:delete-cliente -- --cnpj … --yes
                </code>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="busca-ins-cli" className="text-sm font-medium">
              Filtrar CNPJ, nome ou cidade
            </label>
            <Input
              id="busca-ins-cli"
              placeholder="Digite parte do CNPJ ou nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[1%] whitespace-nowrap">CNPJ</TableHead>
                  <TableHead>Nome / razão</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Cidade</TableHead>
                  <TableHead className="min-w-[200px]">Cadastro Insights</TableHead>
                  <TableHead className="w-[1%] text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                      Nenhum cliente na dimensão (ou filtros não batem).
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((r) => {
                    const checks = montarChecksCadastroInsights(r)
                    const pct = percentualCadastro(checks)
                    const st = parseInsightsClienteBrasilStatus(r.brasil_enriquecimento_status)
                    const resumo = resumoCadastroRow(pct, st)
                    return (
                      <TableRow key={r.cnpj_14}>
                        <TableCell className="font-mono text-xs tabular-nums">
                          <span title={r.cnpj_14}>{formatCnpjDisplay(r.cnpj_14)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{r.nome_cliente ?? '—'}</span>
                          {r.razao_social ? (
                            <p className="text-xs text-muted-foreground truncate max-w-[16rem]">
                              {r.razao_social}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {[r.cidade, r.estado].filter(Boolean).join(' / ') || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={resumo.variant} className="text-[10px] font-normal">
                                {resumo.label}
                              </Badge>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {pct}%
                              </span>
                              <div
                                className="h-1.5 flex-1 min-w-16 max-w-[120px] rounded-full bg-muted overflow-hidden"
                                title={`${checks.filter((c) => c.ok).length}/${checks.length} etapas`}
                              >
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    pct >= 100
                                      ? 'bg-emerald-500/90'
                                      : pct >= 50
                                        ? 'bg-amber-500/80'
                                        : 'bg-muted-foreground/35'
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {checks.map((c) => {
                                const pendenteBr =
                                  c.id === 'brasil' &&
                                  (st === 'pending' || st === 'processing')
                                const hint = c.ok ? 'Ok' : c.detalhe ?? 'Pendente'
                                return (
                                  <span
                                    key={c.id}
                                    title={hint}
                                    className="inline-flex items-center gap-1 text-[10px] text-muted-foreground cursor-default"
                                  >
                                    <CheckIcon ok={c.ok} pending={pendenteBr} />
                                    <span className="max-w-36 truncate">{c.label}</span>
                                  </span>
                                )
                              })}
                              {(st === 'error' || st === 'not_found') && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
                                  <XCircle className="w-3 h-3" />
                                  BrasilAPI
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog
                            open={openCnpj === r.cnpj_14}
                            onOpenChange={(o) => {
                              if (!o) {
                                setOpenCnpj(null)
                                setConfirmacao('')
                                purge.reset()
                                return
                              }
                              setOpenCnpj(r.cnpj_14)
                            }}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => {
                                setOpenCnpj(r.cnpj_14)
                                purge.reset()
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remover…
                            </Button>
                            <DialogContent showCloseButton className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Remover cliente e todas as NFs?</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                {r.nome_cliente ? (
                                  <>
                                    <span className="font-medium text-foreground">
                                      {r.nome_cliente}
                                    </span>
                                    {' — '}
                                  </>
                                ) : null}
                                CNPJ{' '}
                                <span className="font-mono text-foreground">
                                  {formatCnpjDisplay(r.cnpj_14)}
                                </span>
                                . Todas as notas de sell-out territorial desse cliente e os respetivos
                                itens serão apagados.
                              </p>
                              <div className="space-y-1.5">
                                <label htmlFor="purge-confirm" className="text-sm font-medium">
                                  Para confirmar, digite o CNPJ deste cliente
                                </label>
                                <Input
                                  id="purge-confirm"
                                  type="text"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  placeholder={formatCnpjDisplay(r.cnpj_14)}
                                  value={confirmacao}
                                  onChange={(e) => setConfirmacao(e.target.value)}
                                  className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Aceita com ou sem máscara (ex.{' '}
                                  <code>{formatCnpjDisplay(r.cnpj_14)}</code> ou{' '}
                                  <code>{r.cnpj_14}</code>).
                                </p>
                              </div>
                              {erroRpc ? (
                                <p className="text-sm text-red-600 dark:text-red-400">{erroRpc}</p>
                              ) : null}
                              <DialogFooter className="gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setOpenCnpj(null)
                                    setConfirmacao('')
                                    purge.reset()
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  variant="destructive"
                                  disabled={
                                    !confirmacaoBateCnpj(confirmacao, r.cnpj_14) || purge.isPending
                                  }
                                  onClick={() => {
                                    const p = parseInsightsCnpj(r.cnpj_14)
                                    const norm = p.ok ? p.cnpj14 : insightsCnpjKey(r.cnpj_14)
                                    purge.mutate({
                                      cnpjNorm: norm,
                                      confirmacao,
                                    })
                                  }}
                                >
                                  {purge.isPending ? 'A apagar…' : 'Confirmar remoção'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
