import type { AuthEmailVariant, InviteEmailAcesso } from './auth-email-template.ts'
import {
  assuntoAuthEmail,
  corpoAuthEmailHtml,
  corpoAuthEmailTexto,
} from './auth-email-template.ts'
import { enviarEmailResend, resendConfigurado } from './resend-client.ts'

export async function enviarAuthEmail(args: {
  variant: AuthEmailVariant
  email: string
  actionLink: string
  nome?: string
  acesso?: InviteEmailAcesso
}): Promise<{ ok: boolean; message?: string }> {
  if (!resendConfigurado()) {
    return {
      ok: false,
      message: 'RESEND_API_KEY não configurada — e-mails transacionais exigem Resend.',
    }
  }

  const content = {
    variant: args.variant,
    actionLink: args.actionLink,
    nome: args.nome,
    acesso: args.acesso,
  }

  return enviarEmailResend({
    to: args.email,
    subject: assuntoAuthEmail(args.variant),
    html: corpoAuthEmailHtml(content),
    text: corpoAuthEmailTexto(content),
  })
}
