/* Mesh — símbolo paramétrico.
 *
 * O losango de malha (GUIA-DE-MARCA-MESH.md §6) como grade triangulada
 * calculada, não um SVG de coordenadas fixas. `vector-effect="non-scaling-stroke"`
 * fixa a espessura do traço em pixels reais de tela — sem isso, o mesmo
 * strokeWidth em unidades de viewBox renderiza grosso ou some dependendo do
 * tamanho do container (17px vs 150px já é 9x de diferença de escala).
 * `subdivisions` continua controlando a densidade da grade: mesmo com
 * traço garantido visível, grade fina demais pra o container vira mancha —
 * escolher pelo tamanho de render real. Um componente só, em vez de 2-3
 * SVGs hardcoded por tamanho, porque a densidade certa depende do
 * container, não é uma escolha de design fixa.
 *
 * Guia de subdivisions por contexto:
 *   2  favicon / BrandMark "sm"   (~16-32px reais)
 *   3  BrandMark "sm" em telas HiDPI, ícones médios (~40-56px)
 *   5  BrandMark "hero" — login, capa (~96-160px)
 *
 * O nó âmbar fica sempre no mesmo vértice relativo (bottom-right), a ~60%
 * da aresta direita->inferior — reconhecível de longe, como pede o guia.
 */
export function MeshDiamond({
  subdivisions = 4,
  className,
}: {
  subdivisions?: number
  className?: string
}) {
  const N = Math.max(1, Math.round(subdivisions))
  const cx = 50
  const cy = 50
  const R = 42
  const a = R / N

  const point = (i: number, j: number) => ({
    x: cx + a * (i - j),
    y: cy - a * N + a * (i + j),
  })

  const lines: { x1: number; y1: number; x2: number; y2: number; boundary: boolean }[] = []
  for (let i = 0; i <= N; i++) {
    const p0 = point(i, 0)
    const p1 = point(i, N)
    lines.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, boundary: i === 0 || i === N })
  }
  for (let j = 0; j <= N; j++) {
    const p0 = point(0, j)
    const p1 = point(N, j)
    lines.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, boundary: j === 0 || j === N })
  }

  // Nó: ~60% da aresta direita (vértice direito -> vértice inferior).
  const nodeJ = N * 0.6
  const node = point(N, nodeJ)

  // vector-effect="non-scaling-stroke": a espessura abaixo é pixels de tela
  // reais, não unidades do viewBox — por isso não some em containers
  // pequenos nem fica grossa demais nos grandes. Sem isso, o mesmo número
  // produziria traços de espessura real bem diferente por tamanho de uso.
  const strokeThin = 1.15
  const strokeBold = 2.3

  return (
    <svg viewBox="0 0 100 100" fill="none" role="img" aria-label="Mesh" className={className}>
      <g stroke="currentColor" strokeLinecap="round">
        {lines.map((l, idx) => (
          <line
            key={idx}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            strokeWidth={l.boundary ? strokeBold : strokeThin}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <circle cx={node.x} cy={node.y} r={R * 0.088} fill="var(--color-amber)" />
    </svg>
  )
}
