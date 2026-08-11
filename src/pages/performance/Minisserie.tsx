/**
 * Sparkline em SVG inline — de propósito sem Recharts.
 *
 * Uma tabela de clientes pode ter milhares de linhas, e um ResponsiveContainer
 * por linha instala um ResizeObserver por linha. Aqui é um <path> e nada mais.
 */

const LARGURA = 64
const ALTURA = 18

interface Props {
  valores: number[]
  className?: string
}

export function Minisserie({ valores, className }: Props) {
  if (valores.length < 2) return null

  const max = Math.max(...valores)
  const min = Math.min(...valores)
  const amplitude = max - min || 1

  const passo = LARGURA / (valores.length - 1)
  const d = valores
    .map((v, i) => {
      const x = i * passo
      const y = ALTURA - ((v - min) / amplitude) * ALTURA
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const ultimo = valores[valores.length - 1]
  const penultimo = valores[valores.length - 2]
  const subindo = ultimo >= penultimo

  return (
    <svg
      width={LARGURA}
      height={ALTURA}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={subindo ? 'stroke-success' : 'stroke-destructive'}
      />
    </svg>
  )
}
