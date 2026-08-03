const ETAPAS = {
  receita_universo: 'receita_universo',
  score_modelo: 'score_modelo',
  geocode_cnefe: 'geocode_cnefe',
  cruzamento: 'cruzamento',
  cobertura: 'cobertura',
  google_sinal: 'google_sinal',
}

export { ETAPAS }

export async function criarExecucao(supabase, etapa, parametros = {}) {
  const { data, error } = await supabase
    .from('alwayson_pdv_pipeline_execucoes')
    .insert({
      etapa,
      parametros,
      status: 'processando',
      iniciado_em: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function concluirExecucao(supabase, id, resultado) {
  const { error } = await supabase
    .from('alwayson_pdv_pipeline_execucoes')
    .update({
      status: 'concluido',
      resultado,
      concluido_em: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function falharExecucao(supabase, id, erro) {
  const payload =
    erro instanceof Error
      ? { message: erro.message, stack: erro.stack }
      : typeof erro === 'object'
        ? erro
        : { message: String(erro) }
  const { error: dbErr } = await supabase
    .from('alwayson_pdv_pipeline_execucoes')
    .update({
      status: 'erro',
      erro: payload,
      concluido_em: new Date().toISOString(),
    })
    .eq('id', id)
  if (dbErr) throw dbErr
}

export async function obterExecucao(supabase, id) {
  const { data, error } = await supabase
    .from('alwayson_pdv_pipeline_execucoes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
