-- Recalcula alwayson_insights_uploads.total_nfs / total_itens após purge de cliente (NFs apagadas em CASCADE).
-- 1) Função auxiliar (chamada pela RPC de purge e, com service role, pelo script CLI).
-- 2) insights_delete_cliente_e_nfs: guarda upload_id(s) afetados antes do DELETE e reconcilia depois.
--
-- Pré-requisito: 016_insights_cliente_purge_cascade.sql
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── Recalcular totais por lote ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.insights_reconcile_upload_totals(p_upload_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u       uuid;
  cnt_nf  int;
  cnt_it  int;
BEGIN
  IF p_upload_ids IS NULL THEN
    RETURN;
  END IF;

  FOREACH u IN ARRAY p_upload_ids
  LOOP
    SELECT count(*) INTO cnt_nf FROM alwayson_insights_nf WHERE upload_id = u;

    SELECT count(*) INTO cnt_it
    FROM alwayson_insights_nf_itens i
    INNER JOIN alwayson_insights_nf n ON n.id = i.nf_id
    WHERE n.upload_id = u;

    UPDATE alwayson_insights_uploads
    SET total_nfs = cnt_nf, total_itens = cnt_it
    WHERE id = u;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.insights_reconcile_upload_totals(uuid[]) IS
  'Define total_nfs e total_itens de cada upload a partir das linhas vigentes nas tabelas de NF/itens.';

REVOKE ALL ON FUNCTION public.insights_reconcile_upload_totals(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insights_reconcile_upload_totals(uuid[]) TO service_role;

-- ─── Purge cliente: reconciliar uploads tocados ───────────────────────────────

CREATE OR REPLACE FUNCTION public.insights_delete_cliente_e_nfs(p_cnpj_14 text, p_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exp                text;
  n                  int;
  c_digits           text := regexp_replace(coalesce(p_cnpj_14, ''), '\D', '', 'g');
  c_clean            text;
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

  SELECT pc.secret INTO exp FROM alwayson_insights_purge_config pc WHERE pc.id = 1;
  IF exp IS NULL OR coalesce(trim(p_secret), '') = '' OR p_secret IS DISTINCT FROM exp THEN
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
  'Exclui sempreon_insights_clientes; CASCADE apaga NF e itens; recalcula totais dos uploads afetados.';
