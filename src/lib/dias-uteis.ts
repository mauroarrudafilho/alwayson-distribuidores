/**
 * Dias úteis para o pacing do Início.
 *
 * Conta apenas fins de semana (sábado/domingo) — feriados ficam fora por ora:
 * o calendário de feriados nacional ainda não existe como dado (a operação é
 * por estado e o feriado municipal também entraria). Quando o Pacote C trouxer
 * o calendário operacional, é só trocar a base destas funções.
 */

function ehDiaUtil(d: Date): boolean {
  const dia = d.getDay()
  return dia !== 0 && dia !== 6
}

/** Dias úteis entre dia 1 e o último dia do mês `YYYY-MM`, inclusive. */
export function diasUteisNoMes(ym: string): number {
  const [ano, mes] = ym.split('-').map(Number)
  const total = new Date(ano, mes, 0).getDate()
  let count = 0
  for (let d = 1; d <= total; d++) {
    if (ehDiaUtil(new Date(ano, mes - 1, d))) count++
  }
  return count
}

/**
 * Dias úteis já decorridos do mês corrente até `hoje` inclusive.
 * Usa hora local — o browser decide "que dia é hoje" para a operação.
 */
export function diasUteisAteHoje(hoje: Date = new Date()): number {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  let count = 0
  for (let d = 1; d <= hoje.getDate(); d++) {
    if (ehDiaUtil(new Date(ano, mes, d))) count++
  }
  return count
}
