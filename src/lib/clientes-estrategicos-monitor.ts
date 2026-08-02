import type { CriterioEstrategicoConfig } from '@/types/clientes-estrategicos'
import type { ClienteDistribuidor } from '@/types/distribuidor'

export type CriterioCellStatus = 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'

export interface CriterioCell {
  criterio_nome: string
  realizado: number | null
  status: CriterioCellStatus
}

export const STATUS_CELL_CLASSES: Record<CriterioCellStatus, string> = {
  verde: 'text-emerald-600 dark:text-emerald-400',
  amarelo: 'text-amber-600 dark:text-amber-400',
  vermelho: 'text-red-600 dark:text-red-400',
  sem_dados: 'text-muted-foreground',
}

/**
 * Mapeia o critério configurado para um número do cadastro do cliente.
 *
 * Só cobre critérios **automáticos** (derivados do que já está no cadastro).
 * Critério de verificação de campo — material de PDV, visita — cai em `null`
 * e aparece como "sem dados": é honesto, ninguém preencheu.
 */
function realizadoForCriterio(
  cliente: ClienteDistribuidor,
  cfg: CriterioEstrategicoConfig
): number | null {
  const n = cfg.criterio_nome.toLowerCase()
  if (/mix|cadastr|item|sku/i.test(n)) return cliente.itens_cadastrados
  if (/ticket|fatur|volume/i.test(n)) return cliente.ticket_medio ?? null
  if (/freq|recorr|dia/i.test(n)) return cliente.frequencia_compra_dias ?? null
  return null
}

function statusFor(
  cfg: CriterioEstrategicoConfig,
  realizado: number | null
): CriterioCellStatus {
  if (realizado === null) return 'sem_dados'
  const meta = cfg.meta_valor
  if (meta === 0) return 'sem_dados'
  const r =
    cfg.tipo_comparacao === 'min' ? realizado / meta : meta / Math.max(realizado, 1e-9)
  if (r >= 1) return 'verde'
  if (r >= 0.7) return 'amarelo'
  return 'vermelho'
}

export function buildCriteriosForCliente(
  configs: CriterioEstrategicoConfig[],
  cliente: ClienteDistribuidor
): CriterioCell[] {
  return configs.map((cfg) => {
    const realizado = realizadoForCriterio(cliente, cfg)
    return {
      criterio_nome: cfg.criterio_nome,
      realizado,
      status: statusFor(cfg, realizado),
    }
  })
}

/**
 * Com "todos os distribuidores" selecionados, o mesmo critério pode vir
 * repetido (um por distribuidor) e viraria coluna duplicada.
 */
export function dedupeCriterios(
  configs: CriterioEstrategicoConfig[]
): CriterioEstrategicoConfig[] {
  const m = new Map<string, CriterioEstrategicoConfig>()
  for (const c of [...configs].sort((a, b) => a.ordem - b.ordem)) {
    if (!m.has(c.criterio_nome)) m.set(c.criterio_nome, c)
  }
  return [...m.values()]
}

export type AcompanhamentoLabel = 'aderente' | 'em_risco' | 'fora_do_padrao' | 'sem_criterios'

export function deriveScoreLabel(criterios: CriterioCell[]): AcompanhamentoLabel {
  const valid = criterios.filter((x) => x.status !== 'sem_dados')
  // Sem critério medível não é "fora do padrão" — é ausência de régua. Marcar
  // como fora do padrão faria toda lista nova nascer vermelha.
  if (valid.length === 0) return 'sem_criterios'
  const greens = valid.filter((x) => x.status === 'verde').length
  const ratio = greens / valid.length
  if (ratio >= 0.7) return 'aderente'
  if (ratio >= 0.4) return 'em_risco'
  return 'fora_do_padrao'
}
