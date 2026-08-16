/* Mesh — camada de malha.
 *
 * Uma paisagem, vários enquadramentos: TODA peça usa este mesmo componente,
 * variando só densidade e recorte. Ninguém redesenha a malha à mão.
 *
 * density:
 *   "hero"    telas sem dado (login, capa, hero do site)
 *   "content" telas com pouco dado (marketing, e-mail, slide)
 *   "data"    telas com dado real (dashboard, tabelas) — quase invisível
 */
import terrain from '@/assets/mesh-terrain.svg?raw'

// O SVG de origem trava a cor com style="color:#..." na tag raiz — remove pra
// o prop `color` abaixo realmente valer (senão a malha ignora o tom pedido).
const terrainInherited = terrain.replace(/\sstyle="color:[^"]*"/, '')

type Density = 'hero' | 'content' | 'data'

const OPACITY: Record<Density, number> = {
  hero: 0.85,
  content: 0.35,
  data: 0.06,
}

export function MeshTerrain({
  density = 'hero',
  className = '',
  color = 'var(--color-structure-soft)',
}: {
  density?: Density
  className?: string
  color?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 select-none ${className}`}
      style={{ color, opacity: OPACITY[density] }}
      dangerouslySetInnerHTML={{ __html: terrainInherited }}
    />
  )
}

/* Notas de implementação, não apagar:
 *
 * 1. O SVG usa stroke="currentColor". A cor vem do container, então a mesma
 *    arte serve fundo claro e escuro sem gerar um segundo arquivo.
 * 2. preserveAspectRatio="xMaxYMax slice" mantém o pico da malha ancorado no
 *    canto inferior direito. Não trocar por "none": estica o relevo e a marca
 *    deixa de ser a mesma em monitor ultrawide.
 * 3. Espessura mínima de traço 1.25px. Abaixo disso a linha some em retina.
 */
