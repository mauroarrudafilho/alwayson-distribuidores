const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function resendConfigurado(): boolean {
  return Boolean(Deno.env.get('RESEND_API_KEY')?.trim())
}

export function resendFromAddress(): string {
  return Deno.env.get('RESEND_FROM') ?? 'Mesh <onboarding@resend.dev>'
}

export async function enviarEmailResend(args: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return { ok: false, message: 'RESEND_API_KEY não definida' }
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: resendFromAddress(),
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    })
    if (!res.ok) {
      const corpo = await res.text().catch(() => '')
      return { ok: false, message: `Resend ${res.status}: ${corpo.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
