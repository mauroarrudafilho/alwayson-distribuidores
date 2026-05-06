-- Insights: SELECT para role `anon` + grants nas views analytics.
--
-- Contexto: o SPA usa apenas VITE_SUPABASE_ANON_KEY (sem sessão JWT `authenticated`).
-- docs/migrations/007_insights.sql já habilitou RLS e criou políticas só para `authenticated`;
-- sem este arquivo, PostgREST retorna [] ou erro ao consultar Insights com a anon key.
--
-- Ordem de aplicação: depois de 007_insights.sql e docs/migrations/012_insights_analytics_views.sql

-- ─── Policies SELECT para anon nas tabelas-base ───────────────────────────────

DROP POLICY IF EXISTS "insights_uploads_select_anon" ON alwayson_insights_uploads;
CREATE POLICY "insights_uploads_select_anon"
  ON alwayson_insights_uploads FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "insights_nf_select_anon" ON alwayson_insights_nf;
CREATE POLICY "insights_nf_select_anon"
  ON alwayson_insights_nf FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "insights_itens_select_anon" ON alwayson_insights_nf_itens;
CREATE POLICY "insights_itens_select_anon"
  ON alwayson_insights_nf_itens FOR SELECT TO anon USING (true);

-- ─── Privilégio nas views (PostgREST / API) ───────────────────────────────────

GRANT SELECT ON alwayson_insights_v_cidades TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_clientes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_produtos TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mes TO anon, authenticated;
GRANT SELECT ON alwayson_insights_v_cliente_mix TO anon, authenticated;
