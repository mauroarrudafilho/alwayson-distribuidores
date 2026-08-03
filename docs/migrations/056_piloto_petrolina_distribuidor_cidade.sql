-- Migration 056 — Piloto Explorar: Petrolina/PE na área do distribuidor PARATY.
-- Necessário para RLS de alwayson_pdv_* (current_user_pdv_codigos_ibge_visiveis).
-- Projeto canônico: osukbalwykbqvoumddxz

INSERT INTO alwayson_distribuidor_cidades (distribuidor_id, codigo_ibge)
SELECT d.id, 2611101
FROM alwayson_distribuidores d
WHERE d.nome ILIKE '%PARATY%'
ON CONFLICT (distribuidor_id, codigo_ibge) DO NOTHING;
