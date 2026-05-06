-- Confirmação de purge por CNPJ digitado (estilo "type-to-confirm" do GitHub).
-- A RPC aceita como p_secret o próprio CNPJ do cliente alvo, em qualquer formato
-- (com ou sem máscara). Isso elimina a necessidade de o admin decorar um segredo
-- compartilhado e ainda barra cliques acidentais — para excluir é preciso digitar
-- exatamente os 14 dígitos do CNPJ que aparece no painel.
--
-- A tabela alwayson_insights_purge_config deixa de ser usada por esta RPC, mas
-- permanece no schema para não quebrar migrations anteriores; pode ser droppada
-- numa migration futura quando tivermos certeza de que nada mais a referencia.
--
-- Pré-requisito: 017_insights_upload_totals_reconcile.sql
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.insights_delete_cliente_e_nfs(p_cnpj_14 text, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n                  int;
  c_digits           text := regexp_replace(coalesce(p_cnpj_14, ''), '\D', '', 'g');
  c_clean            text;
  s_digits           text := regexp_replace(coalesce(p_secret, ''), '\D', '', 'g');
  affected_uploads   uuid[];
BEGIN
  IF length(c_digits) >= 14 THEN
    c_clean := right(c_digits, 14);
  ELSE
    c_clean := lpad(c_digits, 14, '0');
  END IF;

  IF c_clean !~ '^[0-9]{14}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cnpj_invalido');
  END IF;

  -- Confirmação: o "segredo" tem de ser o próprio CNPJ do cliente alvo.
  -- Aceitamos qualquer formatação (apenas comparamos os 14 dígitos finais).
  IF length(s_digits) < 14 OR right(s_digits, 14) IS DISTINCT FROM c_clean THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(array_agg(DISTINCT n.upload_id), array[]::uuid[])
  INTO affected_uploads
  FROM alwayson_insights_nf AS n
  WHERE n.cnpj_cliente = c_clean;

  DELETE FROM alwayson_insights_clientes WHERE cnpj_14 = c_clean;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'nao_encontrado', 'cnpj_14', c_clean);
  END IF;

  PERFORM public.insights_reconcile_upload_totals(affected_uploads);

  RETURN jsonb_build_object(
    'ok', true,
    'cnpj_14', c_clean,
    'removidos', n,
    'uploads_recalculados', cardinality(affected_uploads)
  );
END;
$$;

COMMENT ON FUNCTION public.insights_delete_cliente_e_nfs(text, text) IS
  'Exclui alwayson_insights_clientes; confirmação por CNPJ digitado (p_secret deve conter os 14 dígitos do CNPJ alvo); CASCADE apaga NF e itens; recalcula totais dos uploads afetados.';
