/** Protege endpoints de disparo do pipeline (Railway / cron interno). */
export function assertPipelineSecret(req, res) {
  const expected = process.env.PDV_PIPELINE_SECRET?.trim()
  if (!expected) {
    res.status(503).json({
      error: 'pipeline_secret_ausente',
      message: 'PDV_PIPELINE_SECRET não configurado no serviço.',
    })
    return false
  }
  const got = String(req.headers['x-pipeline-secret'] ?? '').trim()
  if (got !== expected) {
    res.status(401).json({ error: 'nao_autorizado', message: 'Segredo inválido.' })
    return false
  }
  return true
}
