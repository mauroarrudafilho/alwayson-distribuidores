-- Ajuste incremental de alwayson_pdv_cobertura ao excluir/restaurar PDV (EyeOff).
-- Espelha montarCobertura em services/pdv-pipeline/lib/cruzamento-cobertura.mjs.
--
-- Projeto canônico: osukbalwykbqvoumddxz

CREATE OR REPLACE FUNCTION public.fn_pdv_label_cnae_grupo(p_cnae text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE trim(coalesce(p_cnae, ''))
    WHEN '4723700' THEN 'Varejo de bebidas'
    WHEN '4711302' THEN 'Minimercados e mercearias'
    WHEN '4711301' THEN 'Supermercados'
    WHEN '5611201' THEN 'Restaurantes'
    WHEN '5611204' THEN 'Bares'
    WHEN '5611205' THEN 'Bares'
    WHEN '4635402' THEN 'Atacado de bebidas'
    ELSE coalesce(nullif(trim(p_cnae), ''), 'Outros')
  END;
$$;

COMMENT ON FUNCTION public.fn_pdv_label_cnae_grupo(text) IS
  'Rótulo de grupo CNAE para agregação de cobertura — espelha cnae-grupo.mjs.';

CREATE OR REPLACE FUNCTION public.fn_pdv_cobertura_ajustar_desconsiderado(
  p_cnpj char(14),
  p_excluir boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uf char(2);
  v_municipio text;
  v_bairro text;
  v_cnae_grupo text;
  v_potencial numeric;
  v_delta int;
  v_cob record;
  v_atendido boolean;
  v_delta_atendidos int;
  v_delta_potencial numeric;
  v_novo_qualificados int;
  v_novo_atendidos int;
  v_novo_potencial numeric;
BEGIN
  v_delta := CASE WHEN p_excluir THEN -1 ELSE 1 END;

  SELECT
    u.uf,
    u.municipio,
    CASE WHEN coalesce(trim(u.bairro), '') = '' THEN '(sem bairro)' ELSE trim(u.bairro) END,
    public.fn_pdv_label_cnae_grupo(u.cnae_principal),
    coalesce(s.potencial_estimado_mensal, 0)
  INTO v_uf, v_municipio, v_bairro, v_cnae_grupo, v_potencial
  FROM alwayson_pdv_universo u
  INNER JOIN alwayson_pdv_score s
    ON s.cnpj = u.cnpj AND s.versao_modelo = 'consolidacao_v2'
  WHERE u.cnpj = p_cnpj;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_cob IN
    SELECT c.id, c.distribuidor_id, c.qtd_qualificados, c.qtd_atendidos, c.potencial_nao_atendido
    FROM alwayson_pdv_cobertura c
    WHERE c.uf = v_uf
      AND c.municipio = v_municipio
      AND c.bairro = v_bairro
      AND c.cnae_grupo = v_cnae_grupo
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM alwayson_clientes_distribuidor cd
      WHERE cd.distribuidor_id = v_cob.distribuidor_id
        AND cd.cnpj = p_cnpj
    ) INTO v_atendido;

    v_delta_atendidos := CASE WHEN v_atendido THEN v_delta ELSE 0 END;
    v_delta_potencial := CASE WHEN v_atendido THEN 0 ELSE v_delta * v_potencial END;

    v_novo_qualificados := greatest(0, v_cob.qtd_qualificados + v_delta);
    v_novo_atendidos := greatest(0, v_cob.qtd_atendidos + v_delta_atendidos);
    v_novo_potencial := greatest(0, coalesce(v_cob.potencial_nao_atendido, 0) + v_delta_potencial);

    UPDATE alwayson_pdv_cobertura
    SET
      qtd_qualificados = v_novo_qualificados,
      qtd_atendidos = v_novo_atendidos,
      potencial_nao_atendido = v_novo_potencial,
      percentual_cobertura = CASE
        WHEN v_novo_qualificados > 0 THEN
          round((v_novo_atendidos::numeric / v_novo_qualificados::numeric) * 100, 2)
        ELSE NULL
      END,
      calculado_em = now()
    WHERE id = v_cob.id;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_pdv_cobertura_ajustar_desconsiderado(char, boolean) IS
  'Incrementa ou decrementa contagens de cobertura ao restaurar/excluir PDV desconsiderado.';

CREATE OR REPLACE FUNCTION public.trg_pdv_desconsiderados_cobertura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_pdv_cobertura_ajustar_desconsiderado(NEW.cnpj, true);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_pdv_cobertura_ajustar_desconsiderado(OLD.cnpj, false);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pdv_desconsiderados_cobertura ON alwayson_pdv_desconsiderados;

CREATE TRIGGER trg_pdv_desconsiderados_cobertura
  AFTER INSERT OR DELETE ON alwayson_pdv_desconsiderados
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_pdv_desconsiderados_cobertura();
