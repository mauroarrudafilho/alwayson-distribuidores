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
  /**
   * Sinal de cor vindo de fora — a mesma variação % mostrada ao lado, não uma
   * leitura própria da minissérie. Comparar só os dois últimos pontos locais
   * pode discordar do total da janela (ex.: +71% no ano, mas caiu no último
   * mês) e pintar a linha de vermelho ao lado de um "+71,2%" verde. `null`
   * quando não há comparação — cor neutra, igual ao "—" do texto.
   */
  positivo: boolean | null
  className?: string
}

export function Minisserie({ valores, positivo, className }: Props) {
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

  const corClasse =
    positivo === null
      ? 'stroke-muted-foreground'
      : positivo
        ? 'stroke-success'
        : 'stroke-destructive'

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
        className={corClasse}
      />
    </svg>
  )
}
