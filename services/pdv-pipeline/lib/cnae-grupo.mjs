/** Rótulos de grupo para agregação de cobertura. */
export const CNAE_GRUPO_LABEL = {
  4723700: 'Varejo de bebidas',
  4711302: 'Minimercados e mercearias',
  4711301: 'Supermercados',
  5611201: 'Restaurantes',
  5611204: 'Bares',
  5611205: 'Bares',
  4635402: 'Atacado de bebidas',
}

export function labelCnaeGrupo(cnae) {
  return CNAE_GRUPO_LABEL[cnae] ?? String(cnae ?? 'Outros')
}
