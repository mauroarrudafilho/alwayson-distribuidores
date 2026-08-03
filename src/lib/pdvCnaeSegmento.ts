/**
 * Segmentos CNAE para Explorar (D — comparar dentro do grupo, não ticket).
 * Espelha services/pdv-pipeline/lib/cnae-grupo.mjs + cnaes.mjs
 */

export type PdvSegmentoCnaeId =
  | 'atacado_bebidas'
  | 'varejo_bebidas'
  | 'supermercado'
  | 'bar'
  | 'restaurante'
  | 'minimercado'
  | 'outros'

export interface PdvSegmentoCnaeDef {
  id: PdvSegmentoCnaeId
  label: string
  cnaes: readonly string[]
  /** Preenchimento da bolha no mapa */
  fill: string
  /** Contorno */
  stroke: string
}

export const PDV_SEGMENTOS_CNAE: readonly PdvSegmentoCnaeDef[] = [
  {
    id: 'atacado_bebidas',
    label: 'Atacado bebidas',
    cnaes: ['4635402'],
    fill: '#6366f1',
    stroke: '#4338ca',
  },
  {
    id: 'varejo_bebidas',
    label: 'Varejo bebidas',
    cnaes: ['4723700'],
    fill: '#0ea5e9',
    stroke: '#0369a1',
  },
  {
    id: 'supermercado',
    label: 'Supermercado',
    cnaes: ['4711301'],
    fill: '#10b981',
    stroke: '#047857',
  },
  {
    id: 'minimercado',
    label: 'Minimercado',
    cnaes: ['4711302'],
    fill: '#84cc16',
    stroke: '#4d7c0f',
  },
  {
    id: 'bar',
    label: 'Bar',
    cnaes: ['5611204', '5611205'],
    fill: '#f97316',
    stroke: '#c2410c',
  },
  {
    id: 'restaurante',
    label: 'Restaurante',
    cnaes: ['5611201'],
    fill: '#ec4899',
    stroke: '#be185d',
  },
]

/** CNAE fora dos grupos prioritários — aparece na legenda quando houver volume. */
export const PDV_SEGMENTO_OUTROS: PdvSegmentoCnaeDef = {
  id: 'outros',
  label: 'Outros',
  cnaes: [],
  fill: '#94a3b8',
  stroke: '#64748b',
}

const CNAE_TO_SEGMENT = new Map<string, PdvSegmentoCnaeDef>()
for (const seg of PDV_SEGMENTOS_CNAE) {
  for (const c of seg.cnaes) CNAE_TO_SEGMENT.set(c, seg)
}

export function segmentoCnaePorCodigo(cnae: string | null | undefined): PdvSegmentoCnaeDef {
  const norm = String(cnae ?? '').replace(/\D/g, '').slice(0, 7)
  return CNAE_TO_SEGMENT.get(norm) ?? PDV_SEGMENTO_OUTROS
}

export function labelSegmentoCnae(cnae: string | null | undefined): string {
  return segmentoCnaePorCodigo(cnae).label
}

/** Espelha services/pdv-pipeline/lib/cnae-grupo.mjs — agregação de cobertura. */
export const CNAE_GRUPO_LABEL: Record<string, string> = {
  '4635402': 'Atacado de bebidas',
  '4723700': 'Varejo de bebidas',
  '4711301': 'Supermercados',
  '4711302': 'Minimercados e mercearias',
  '5611201': 'Restaurantes',
  '5611204': 'Bares',
  '5611205': 'Bares',
}

export function labelCnaeGrupo(cnae: string | null | undefined): string {
  const norm = String(cnae ?? '').replace(/\D/g, '').slice(0, 7)
  return CNAE_GRUPO_LABEL[norm] ?? (norm ? norm : 'Outros')
}

export function bairroCoberturaLabel(bairro: string | null | undefined): string {
  return (bairro ?? '').trim() || '(sem bairro)'
}
