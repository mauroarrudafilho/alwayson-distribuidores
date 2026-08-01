-- Rebrand do tenant admin_global: Grupo Arruda → DevTech Labs
-- Projeto canônico: osukbalwykbqvoumddxz

UPDATE alwayson_tenants
SET nome = 'DevTech Labs',
    slug = 'devtech-labs'
WHERE slug = 'arruda'
   OR nome = 'Grupo Arruda';
