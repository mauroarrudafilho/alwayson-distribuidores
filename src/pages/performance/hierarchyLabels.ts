type HierarchyPerson = { id: string; nome: string }

type HierarchyLike = {
  vendedores: HierarchyPerson[]
} | undefined

export function hierarchyPersonLabel(
  hierarchy: HierarchyLike,
  id: string | undefined,
  fallback = '—'
): string {
  if (!id) return fallback
  return hierarchy?.vendedores.find((v) => v.id === id)?.nome ?? fallback
}
