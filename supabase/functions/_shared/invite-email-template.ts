/** Cores da marca — espelham o hero de login (navy + teal). */
const NAVY_DEEP = '#151e32'
const NAVY = '#1c2840'
const NAVY_MID = '#243352'
const TEAL = '#3ecfbd'
const BG = '#f6f8fb'
const MUTED = '#5c6778'
const BORDER = '#e3e8ef'
const WHITE = '#ffffff'

export type InviteEmailAcesso = {
  fornecedores: string[]
  parceiros: string[]
}

export type InviteEmailContent = {
  actionLink: string
  nome?: string
  acesso?: InviteEmailAcesso
}

function formatParceiro(nome: string): string {
  const token = nome.trim().split(/\s+/)[0] ?? nome
  if (!token) return nome
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

function linhasAcesso(acesso: InviteEmailAcesso): { label: string; valor: string }[] {
  const linhas: { label: string; valor: string }[] = []
  for (const f of acesso.fornecedores) {
    linhas.push({ label: 'Fornecedor', valor: f })
  }
  for (const p of acesso.parceiros) {
    linhas.push({ label: 'Parceiro vinculado', valor: formatParceiro(p) })
  }
  return linhas
}

function blocoAcessoTexto(acesso: InviteEmailAcesso): string {
  const linhas = linhasAcesso(acesso)
  if (!linhas.length) return ''
  return (
    '\n\nComo o seguinte perfil de acesso:\n' +
    linhas.map((l) => `${l.label}: ${l.valor}`).join('\n')
  )
}

function blocoAcessoHtml(acesso: InviteEmailAcesso): string {
  const linhas = linhasAcesso(acesso)
  if (!linhas.length) return ''

  const itens = linhas
    .map((l, index) => {
      const divider =
        index === 0
          ? ''
          : `<tr><td colspan="2" style="height:1px;line-height:1px;background:${BORDER};font-size:0">&nbsp;</td></tr>`
      return `${divider}
      <tr>
        <td colspan="2" style="padding:${index === 0 ? '0' : '14px'} 0 0">
          <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${MUTED}">${escapeHtml(l.label)}</p>
          <p style="margin:0;font-size:16px;line-height:1.35;color:${NAVY};font-weight:500">${escapeHtml(l.valor)}</p>
        </td>
      </tr>`
    })
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="margin:24px 0 0;background:${BG};border:1px solid ${BORDER};border-radius:12px">
    <tr>
      <td style="padding:18px 20px">
        <p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${MUTED}">
          Como o seguinte perfil de acesso
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itens}</table>
      </td>
    </tr>
  </table>`
}

function brandHeaderHtml(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:linear-gradient(135deg,${NAVY_DEEP} 0%,${NAVY_MID} 52%,${NAVY} 100%)">
    <tr>
      <td style="padding:36px 36px 32px">
        <p style="margin:0 0 20px;font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,sans-serif">
          Convite
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:14px">
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="width:40px;height:40px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:rgba(255,255,255,0.05)">
                <tr>
                  <td align="center" valign="middle" style="font-size:16px;font-weight:500;color:#ffffff;font-family:Georgia,serif">A</td>
                  <td valign="top" style="width:10px;padding:2px 4px 0 0">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:9px;height:9px;border-radius:50%;background:${TEAL};font-size:0;line-height:0">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;font-size:28px;font-weight:400;color:#ffffff;letter-spacing:-0.03em;line-height:1;font-family:Georgia,serif">Always On</p>
              <p style="margin:6px 0 0;font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-family:system-ui,-apple-system,sans-serif">Distribuidores</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

export function corpoConviteTexto({ actionLink, nome, acesso }: InviteEmailContent): string {
  const saudacao = nome ? `Olá, ${nome}!` : 'Olá!'
  return `${saudacao}

Você foi convidado para a plataforma de gestão Always On.${acesso ? blocoAcessoTexto(acesso) : ''}

Aceitar convite: ${actionLink}

Se o link não abrir, copie e cole no navegador.

— Always On · DevTech Labs`
}

export function corpoConviteHtml({ actionLink, nome, acesso }: InviteEmailContent): string {
  const saudacao = nome ? `Olá, ${nome}!` : 'Olá!'
  const acessoHtml = acesso ? blocoAcessoHtml(acesso) : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Always On</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${NAVY}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:540px;background:${WHITE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;box-shadow:0 24px 48px -32px rgba(21,30,50,0.35)">
          <tr>
            <td style="padding:0">${brandHeaderHtml()}</td>
          </tr>
          <tr>
            <td style="padding:32px 36px 0">
              <p style="margin:0 0 14px;font-size:22px;font-weight:600;color:${NAVY};letter-spacing:-0.02em;font-family:Georgia,serif">${saudacao}</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED}">
                Você foi convidado para a plataforma de gestão
                <strong style="color:${NAVY};font-weight:600">Always On</strong>.
              </p>
              ${acessoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px">
              <a href="${actionLink}"
                 style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase">
                Aceitar convite
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px">
              <p style="margin:0;font-size:12px;line-height:1.65;color:${MUTED}">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                <a href="${actionLink}" style="color:${NAVY};word-break:break-all">${actionLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px;border-top:1px solid ${BORDER};background:${BG}">
              <p style="margin:0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};text-align:center">
                Always On · DevTech Labs
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
