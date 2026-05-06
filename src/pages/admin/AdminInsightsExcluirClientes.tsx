import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Button } from '@/components/ui/button'
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

type InsightClienteDim = {
  cnpj_14: string
  nome_cliente: string | null
  razao_social: string | null
  cidade: string | null
  estado: string | null
}

function formatCnpjDisplay(d14: string) {
  const d = d14.replace(/\D/g, '').padStart(14, '0').slice(-14)
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

export function AdminInsightsExcluirClientes() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [openCnpj, setOpenCnpj] = useState<string | null>(null)
  const [confirmacao, setConfirmacao] = useState('')

  const list = useQuery({
    queryKey: ['admin', 'insights-clientes-purge', 'lista'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alwayson_insights_clientes')
        .select('cnpj_14, nome_cliente, razao_social, cidade, estado')
        .order('cnpj_14')
      if (error) throw error
      return (data ?? []) as InsightClienteDim[]
    },
  })

  const purge = useMutation({
    mutationFn: async ({ cnpjNorm, confirmacao }: { cnpjNorm: string; confirmacao: string }) => {
      const { data, error } = await supabase.rpc('insights_delete_cliente_e_nfs', {
        p_cnpj_14: cnpjNorm,
        // A RPC aceita o próprio CNPJ digitado como confirmação (type-to-confirm).
        // Mantemos o nome `p_secret` na assinatura por retrocompatibilidade.
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
      await qc.invalidateQueries({ queryKey: ['admin', 'insights-clientes-purge'] })
      await qc.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  // Compara digitos do que o admin digita com os 14 dígitos do CNPJ alvo.
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
        title="Exclusão cliente Insights"
        description="Elimina alwayson_insights_clientes e todas as notas e itens ligados ao CNPJ (limpeza após imports antigos)."
      />

      <Card>
        <CardContent className="pt-6 space-y-4 text-sm">
          <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Irreversível</p>
              <p className="text-muted-foreground dark:text-amber-100/85">
                Para confirmar a exclusão, basta digitar o CNPJ exato do cliente no diálogo —
                aceita qualquer formatação. Os totais{' '}
                <code className="text-xs font-mono">total_nfs</code> e{' '}
                <code className="text-xs font-mono">total_itens</code> dos lotes de upload
                afetados são recalculados automaticamente após o purge.
              </p>
              <p className="mt-2 text-muted-foreground dark:text-amber-100/85">
                Alternativa via service role (CLI):{' '}
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
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                      Nenhum cliente na dimensão (ou filtros não batem).
                    </TableCell>
                  </TableRow>
                ) : (
                  filtradas.map((r) => (
                    <TableRow key={r.cnpj_14}>
                      <TableCell className="font-mono text-xs tabular-nums">
                        <span title={r.cnpj_14}>{formatCnpjDisplay(r.cnpj_14)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{r.nome_cliente ?? '—'}</span>
                        {r.razao_social ? (
                          <p className="text-xs text-muted-foreground truncate max-w-[18rem]">
                            {r.razao_social}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {[r.cidade, r.estado].filter(Boolean).join(' / ') || '—'}
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
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            onClick={() => {
                              setOpenCnpj(r.cnpj_14)
                              purge.reset()
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Excluir
                          </Button>
                          <DialogContent showCloseButton className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Excluir cliente e todas as NFs?</DialogTitle>
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
                              . Todas as notas de sell-out territorial desse cliente e os
                              respetivos itens serão apagadas.
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
                                {purge.isPending ? 'A apagar…' : 'Confirmar exclusão'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
