-- Migration 048 — escopo de acesso: de "autenticado vê tudo" para "vê o seu".
--
-- Até aqui todas as tabelas de negócio tinham `SELECT USING (true)`: o tenant
-- escolhido na interface era conveniência de UI, não fronteira de dados. Com um
-- único utilizador (admin global) isso não expunha ninguém, mas o primeiro KAM
-- ou o primeiro utilizador de distribuidor enxergaria os dados de todos os
-- parceiros — que numa plataforma com concorrentes entre si é inaceitável.
--
-- Regra confirmada com o product owner:
--   • Admin global         → tudo
--   • KAM                  → fornecedor ∈ seus  E  distribuidor ∈ seus
--   • Gestor do fornecedor → seu fornecedor, em todos os distribuidores dele
--   • Distribuidor         → o seu distribuidor, qualquer fornecedor
--
-- O "E" do KAM é o ponto delicado. Se fosse "OU", o KAM da Campestre veria a
-- Campestre dentro de distribuidores de outro KAM. Por isso os conjuntos de
-- fornecedor NÃO se expandem para quem já é do lado fornecedor (ver função
-- `current_user_fornecedores_visiveis`).
--
-- Falha fechada por construção: `NULL IN (...)` é NULL, então linha sem carimbo
-- fica invisível para não-admin. Preferível a vazar.
--
-- Insights e IBGE seguem abertos a qualquer autenticado — decisão de produto:
-- o histórico territorial é benchmark para todos os perfis.
--
-- Projeto canônico: osukbalwykbqvoumddxz

-- ─── 1. Papel de KAM ────────────────────────────────────────────────────────
-- Não referenciado nas funções abaixo (o KAM é definido por NÃO ter alcance
-- amplo), mas existe para cadastro e auditoria.

ALTER TYPE alwayson_membership_role ADD VALUE IF NOT EXISTS 'kam';

-- ─── 2. Conjuntos visíveis ──────────────────────────────────────────────────

-- Distribuidores alcançáveis: os de membership direta, mais — só para quem tem
-- alcance amplo de fornecedor (gestor_fornecedor) — todos os distribuidores
-- atendidos pelo seu fornecedor. O KAM não entra nessa segunda parte.
CREATE OR REPLACE FUNCTION public.current_user_distribuidores_visiveis()
RETURNS TABLE (distribuidor_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.distribuidor_id
  FROM alwayson_tenants t
  JOIN alwayson_memberships m ON m.tenant_id = t.id
  WHERE m.user_id = auth.uid() AND m.ativo
    AND t.tipo = 'distribuidor' AND t.distribuidor_id IS NOT NULL
  UNION
  SELECT fd.distribuidor_id
  FROM alwayson_fornecedor_distribuidores fd
  JOIN alwayson_tenants t     ON t.id = fd.fornecedor_tenant_id
  JOIN alwayson_memberships m ON m.tenant_id = t.id
  WHERE m.user_id = auth.uid() AND m.ativo AND fd.ativo
    AND t.tipo = 'fornecedor'
    AND m.role = 'gestor_fornecedor';
$$;

COMMENT ON FUNCTION public.current_user_distribuidores_visiveis() IS
  'Distribuidores que o utilizador alcança. Gestor do fornecedor alcança todos os do seu fornecedor; KAM só os de membership explícita.';

-- Fornecedores visíveis. Para quem é do lado fornecedor são exatamente os seus
-- — sem expansão, senão o KAM veria outros fornecedores dentro dos
-- distribuidores dele e o "E" cairia. Para quem é do lado distribuidor, são os
-- fornecedores que atendem os seus distribuidores.
CREATE OR REPLACE FUNCTION public.current_user_fornecedores_visiveis()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id
  FROM alwayson_tenants t
  JOIN alwayson_memberships m ON m.tenant_id = t.id
  WHERE m.user_id = auth.uid() AND m.ativo AND t.tipo = 'fornecedor'
  UNION
  SELECT fd.fornecedor_tenant_id
  FROM alwayson_fornecedor_distribuidores fd
  WHERE fd.ativo
    AND fd.distribuidor_id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
    AND NOT EXISTS (
      SELECT 1
      FROM alwayson_tenants t2
      JOIN alwayson_memberships m2 ON m2.tenant_id = t2.id
      WHERE m2.user_id = auth.uid() AND m2.ativo AND t2.tipo = 'fornecedor'
    );
$$;

COMMENT ON FUNCTION public.current_user_fornecedores_visiveis() IS
  'Fornecedores que o utilizador alcança. Quem pertence a um fornecedor vê só o seu (preserva o E do KAM); quem é do distribuidor vê os fornecedores que o atendem.';

REVOKE EXECUTE ON FUNCTION public.current_user_distribuidores_visiveis() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_fornecedores_visiveis() FROM anon;

-- ─── 3. Policies ────────────────────────────────────────────────────────────
-- Substituem as `USING (true)`. Só SELECT: as regras de escrita já existentes
-- (admin / service_role) permanecem como estão.

-- 3.1 Dois eixos — o "E" vive aqui.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alwayson_faturamento',
    'alwayson_metas_distribuidor',
    'alwayson_relatorios_ingestao',
    'alwayson_estoque_distribuidor'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_authenticated', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR (
          distribuidor_id      IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
          AND fornecedor_tenant_id IN (SELECT f.tenant_id  FROM public.current_user_fornecedores_visiveis() f)
        )
      )$f$, t || '_select_escopo', t);
  END LOOP;
END $$;

-- 3.2 Só o eixo distribuidor (cliente e equipa são do distribuidor,
--     independentemente de quem fornece).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alwayson_clientes_distribuidor',
    'alwayson_vendedores_distribuidor',
    'alwayson_distribuidor_cidades',
    'alwayson_distribuidor_produto_de_para',
    'alwayson_excelencia_clientes',
    'alwayson_excelencia_config',
    'alwayson_performance_periodo'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_select_authenticated', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR SELECT TO authenticated
      USING (
        public.current_user_is_admin()
        OR distribuidor_id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
      )$f$, t || '_select_escopo', t);
  END LOOP;
END $$;

-- 3.3 Catálogo — só o eixo fornecedor.
DROP POLICY IF EXISTS alwayson_produtos_select_authenticated ON alwayson_produtos;
DROP POLICY IF EXISTS alwayson_produtos_select_escopo ON alwayson_produtos;
CREATE POLICY alwayson_produtos_select_escopo
  ON alwayson_produtos FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR fornecedor_tenant_id IN (SELECT f.tenant_id FROM public.current_user_fornecedores_visiveis() f)
  );

-- 3.4 O próprio distribuidor.
DROP POLICY IF EXISTS alwayson_distribuidores_select_authenticated ON alwayson_distribuidores;
DROP POLICY IF EXISTS alwayson_distribuidores_select_escopo ON alwayson_distribuidores;
CREATE POLICY alwayson_distribuidores_select_escopo
  ON alwayson_distribuidores FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR id IN (SELECT d.distribuidor_id FROM public.current_user_distribuidores_visiveis() d)
  );

-- 3.5 Filhas — herdam o escopo do pai via EXISTS (não têm eixo próprio).
DROP POLICY IF EXISTS alwayson_faturamento_itens_select_authenticated ON alwayson_faturamento_itens;
DROP POLICY IF EXISTS alwayson_faturamento_itens_select_escopo ON alwayson_faturamento_itens;
CREATE POLICY alwayson_faturamento_itens_select_escopo
  ON alwayson_faturamento_itens FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_faturamento f
      WHERE f.id = alwayson_faturamento_itens.faturamento_id
    )
  );

DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_select_authenticated ON alwayson_clientes_ajustes_cadastro;
DROP POLICY IF EXISTS alwayson_clientes_ajustes_cadastro_select_escopo ON alwayson_clientes_ajustes_cadastro;
CREATE POLICY alwayson_clientes_ajustes_cadastro_select_escopo
  ON alwayson_clientes_ajustes_cadastro FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_clientes_distribuidor c
      WHERE c.id = alwayson_clientes_ajustes_cadastro.cliente_id
    )
  );

DROP POLICY IF EXISTS alwayson_excelencia_criterios_select_authenticated ON alwayson_excelencia_criterios;
DROP POLICY IF EXISTS alwayson_excelencia_criterios_select_escopo ON alwayson_excelencia_criterios;
CREATE POLICY alwayson_excelencia_criterios_select_escopo
  ON alwayson_excelencia_criterios FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM alwayson_clientes_distribuidor c
      WHERE c.id = alwayson_excelencia_criterios.cliente_id
    )
  );

-- Nota sobre as filhas: o EXISTS não repete o predicado do pai de propósito —
-- a policy do pai já filtra o que o utilizador enxerga, então a linha-filha só
-- aparece se a mãe aparecer. Repetir a regra criaria dois lugares para manter.
