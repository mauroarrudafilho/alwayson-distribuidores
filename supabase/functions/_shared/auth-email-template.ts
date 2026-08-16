/** Templates de e-mail transacionais Mesh — convite, recovery, acesso existente. */

const INK_DEEP = '#0b0d11'
const INK = '#0f1115'
const INK_MID = '#1a1e26'
const AMBER = '#ff7a1a'
const BG = '#f7f5f1'
const MUTED = '#5b6572'
const BORDER = '#e5e1d8'
const WHITE = '#ffffff'

export type AuthEmailVariant = 'convite' | 'recuperar_senha' | 'acesso_existente'

export type InviteEmailAcesso = {
  fornecedores: string[]
  parceiros: string[]
}

export type AuthEmailContent = {
  variant: AuthEmailVariant
  actionLink: string
  nome?: string
  acesso?: InviteEmailAcesso
}

const VARIANT_META: Record<
  AuthEmailVariant,
  { eyebrow: string; subject: string; button: string; introHtml: (nome?: string) => string; introText: (nome?: string) => string }
> = {
  convite: {
    eyebrow: 'Convite',
    subject: 'Seu acesso à plataforma Mesh',
    button: 'Aceitar convite',
    introHtml: (nome) =>
      nome
        ? `Você foi convidado para a plataforma de gestão <strong style="color:${INK};font-weight:600">Mesh</strong>.`
        : `Você foi convidado para a plataforma de gestão <strong style="color:${INK};font-weight:600">Mesh</strong>.`,
    introText: () => 'Você foi convidado para a plataforma de gestão Mesh.',
  },
  recuperar_senha: {
    eyebrow: 'Recuperar acesso',
    subject: 'Redefina sua senha — Mesh',
    button: 'Definir nova senha',
    introHtml: () =>
      `Recebemos um pedido para redefinir a senha da sua conta na plataforma <strong style="color:${INK};font-weight:600">Mesh</strong>. Se não foi você, ignore este e-mail.`,
    introText: () =>
      'Recebemos um pedido para redefinir a senha da sua conta na plataforma Mesh. Se não foi você, ignore este e-mail.',
  },
  acesso_existente: {
    eyebrow: 'Acesso',
    subject: 'Continue seu acesso — Mesh',
    button: 'Continuar na plataforma',
    introHtml: () =>
      `Há um convite pendente para a sua conta na plataforma <strong style="color:${INK};font-weight:600">Mesh</strong>. Use o link abaixo para continuar.`,
    introText: () => 'Há um convite pendente para a sua conta na plataforma Mesh.',
  },
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
          <p style="margin:0;font-size:16px;line-height:1.35;color:${INK};font-weight:500">${escapeHtml(l.valor)}</p>
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

function brandHeaderHtml(eyebrow: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:linear-gradient(135deg,${INK_DEEP} 0%,${INK_MID} 52%,${INK} 100%)">
    <tr>
      <td style="padding:36px 36px 32px">
        <p style="margin:0 0 20px;font-size:10px;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:rgba(255,255,255,0.45);font-family:system-ui,-apple-system,sans-serif">
          ${escapeHtml(eyebrow)}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:14px">
              <table role="presentation" cellpadding="0" cellspacing="0"
                     style="width:40px;height:40px;border:1px solid rgba(255,255,255,0.16);border-radius:8px;background:rgba(255,255,255,0.05)">
                <tr>
                  <td align="center" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:10px;height:10px;border-radius:50%;background:${AMBER};font-size:0;line-height:0">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0;font-size:28px;font-weight:400;color:#ffffff;letter-spacing:-0.03em;line-height:1;font-family:Georgia,serif">Mesh</p>
              <p style="margin:6px 0 0;font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.5);font-family:system-ui,-apple-system,sans-serif">Distribuidores</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

export function corpoAuthEmailTexto(content: AuthEmailContent): string {
  const meta = VARIANT_META[content.variant]
  const saudacao = content.nome ? `Olá, ${content.nome}!` : 'Olá!'
  return `${saudacao}

${meta.introText(content.nome)}${content.acesso ? blocoAcessoTexto(content.acesso) : ''}

${meta.button}: ${content.actionLink}

Se o link não abrir, copie e cole no navegador.
O link expira em algumas horas e só pode ser usado uma vez.

— Mesh · DevTech Labs`
}

export function corpoAuthEmailHtml(content: AuthEmailContent): string {
  const meta = VARIANT_META[content.variant]
  const saudacao = content.nome ? `Olá, ${content.nome}!` : 'Olá!'
  const acessoHtml = content.acesso ? blocoAcessoHtml(content.acesso) : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mesh</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:540px;background:${WHITE};border:1px solid ${BORDER};border-radius:16px;overflow:hidden;box-shadow:0 24px 48px -32px rgba(21,30,50,0.35)">
          <tr>
            <td style="padding:0">${brandHeaderHtml(meta.eyebrow)}</td>
          </tr>
          <tr>
            <td style="padding:32px 36px 0">
              <p style="margin:0 0 14px;font-size:22px;font-weight:600;color:${INK};letter-spacing:-0.02em;font-family:Georgia,serif">${escapeHtml(saudacao)}</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED}">
                ${meta.introHtml(content.nome)}
              </p>
              ${acessoHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px">
              <a href="${content.actionLink}"
                 style="display:inline-block;background:${INK};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase">
                ${escapeHtml(meta.button)}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 28px">
              <p style="margin:0;font-size:12px;line-height:1.65;color:${MUTED}">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br />
                <a href="${content.actionLink}" style="color:${INK};word-break:break-all">${content.actionLink}</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:1.55;color:${MUTED}">
                Por segurança, o link expira em algumas horas e só pode ser usado uma vez.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px;border-top:1px solid ${BORDER};background:${BG}">
              <p style="margin:0;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${MUTED};text-align:center">
                Mesh · DevTech Labs
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

export function assuntoAuthEmail(variant: AuthEmailVariant): string {
  return VARIANT_META[variant].subject
}

/** Compat — convite legado. */
export type InviteEmailContent = Omit<AuthEmailContent, 'variant'> & { actionLink: string; nome?: string; acesso?: InviteEmailAcesso }

export function corpoConviteTexto(content: InviteEmailContent): string {
  return corpoAuthEmailTexto({ ...content, variant: 'convite' })
}

export function corpoConviteHtml(content: InviteEmailContent): string {
  return corpoAuthEmailHtml({ ...content, variant: 'convite' })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
