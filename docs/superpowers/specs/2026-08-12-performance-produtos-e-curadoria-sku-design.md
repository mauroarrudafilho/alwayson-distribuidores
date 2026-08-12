# Aba Produtos na Performance + curadoria de SKU órfão

> Design validado em 2026-08-12. Duas peças de natureza diferente — leitura
> (aba nova, reaproveita infra de 2026-08-11) e escrita (curadoria admin,
> caminho novo) — num spec só, por pedido do usuário.

## Problema

A Performance tem 5 abas, todas organizadas por "quem vendeu" (Distribuidor →
Gerência → Supervisão → Vendas → Cliente). Nenhuma responde "o que vendeu" —
quais produtos crescem, quais caem. O SKU já existe em
`alwayson_faturamento_itens`, mas nunca foi organizado como eixo próprio.

No caminho, achamos um problema adjacente: **7 dos 36 SKUs vendidos (5,3% do
faturamento de itens, R$ 800.599) não têm produto correspondente cadastrado**
em `alwayson_produtos` — o catálogo do fornecedor (69 SKUs) ficou atrás da
operação real. Sem tratar isso, esses SKUs apareceriam na aba nova sem nome
legível, ou pior, sumiriam se a query usasse `INNER JOIN`.

## Descobertas que mudaram o desenho, no processo

1. **`alwayson_faturamento_itens.produto_id`** já existe (FK para
   `alwayson_produtos.id`) e já está preenchido em 91% das linhas — a
   ingestão resolve automaticamente por SKU no momento da carga. Os 2.096
   registros com `produto_id IS NULL` são exatamente os mesmos 7 SKUs órfãos,
   linha por linha. **Não precisamos inventar detecção de órfão — já existe.**
2. **`alwayson_produtos` não tem nenhuma política de escrita hoje.** RLS
   ligado, só SELECT. Confirmado: nenhum código React grava nessa tabela —
   só migrations SQL manuais.
3. **O precedente real não é `AdminAjustesCadastro`** (que é um log de
   auditoria apontando para outra tabela) — **é
   `AdminInsightsDeParaProdutos.tsx`**, que já resolve exatamente este
   problema para o histórico do Insights: uma tabela de-para
   (`alwayson_insights_produto_de_para`, código de origem → SKU do
   catálogo) e uma view que resolve por `LEFT JOIN` na leitura, nunca
   escrevendo na tabela de fato.
4. **Esse precedente só faz alias para SKU já existente — nunca cria produto
   novo.** `handleVincularManual` bloqueia se o SKU digitado não estiver em
   `alwayson_produtos`. Decisão do usuário: seguir exatamente essa forma. Os
   7 órfãos de hoje, que parecem produtos genuinamente novos (não
   reescritas de SKUs existentes), continuam sem solução pela tela —
   cadastro de produto novo continua sendo SQL manual, fora deste spec.
5. **Isso elimina a necessidade de Edge Function.** Sem criar linha em
   `alwayson_produtos` e sem fazer backfill em `alwayson_faturamento_itens`
   (que não tem policy de escrita para `authenticated`), a curadoria vira só
   um INSERT numa tabela de-para nova — mesmo mecanismo do Insights,
   direto do client, sem serviço privilegiado no caminho.

## Parte A — Aba Produtos

### Decisões

1. **Evolução, não mix.** Mesmo molde de Gerência/Supervisão/Vendas: tabela
   por SKU com Faturamento + coluna Evolução (variação % + minissérie), e o
   gráfico macro (`EvolucaoGraficoNivel`, sem alteração) com os SKUs top.
   Curva de Pareto / concentração fica para uma iteração futura, se fizer
   falta.
2. **Só R$, como as outras abas.** Sem métrica de quantidade nesta entrega —
   mantém a aba consistente com o resto da Performance. (Nota lateral: o KPI
   "Itens Vendidos" que já existe nas outras abas é, na verdade, contagem de
   SKUs distintos, não volume — não introduzir um segundo sentido de "item"
   nesta aba evita a confusão, mas o rótulo enganoso das outras abas
   continua existindo, fora de escopo aqui.)
3. **Com os mesmos filtros de hierarquia que Vendas/Cliente têm hoje.** "O
   que este vendedor vende" é uma pergunta real. Tecnicamente simples: cada
   linha de `alwayson_faturamento_itens` já carrega `vendedor_id` via a nota
   pai, então filtrar por hierarquia é o mesmo padrão client-side que
   `VendasTab`/`SupervisaoTab` já usam (`hierarchy.getSubordinateIds`) — não
   precisa de uma view de rollup por nível como a de gerente/supervisor
   (migration 068), porque "gerente" não é uma dimensão do produto, é um
   filtro sobre quem vendeu.
4. **Tabela plana por SKU — sem sub-hierarquia.** Produto não tem "níveis"
   como a hierarquia de vendas. Uma aba, uma tabela.

### Dados

View nova, grão `(distribuidor_id, fornecedor_tenant_id, vendedor_id, sku,
mes)`, validada contra o banco em 2026-08-12 — 9.484 linhas, faturamento
batendo exato com o controle (R$ 15.104.043,07):

```sql
-- alwayson_faturamento_v_mensal_produto — série mensal por SKU e vendedor.
--
-- Nome do produto resolvido em cascata: produto_id (91% das linhas, já
-- resolvido na ingestão) → alwayson_faturamento_produto_de_para (Parte B,
-- alias manual) → descricao crua do item. Nunca fica sem nome, mesmo para
-- os 7 SKUs órfãos de hoje.
CREATE VIEW alwayson_faturamento_v_mensal_produto
WITH (security_invoker = true) AS
SELECT
  f.distribuidor_id,
  f.fornecedor_tenant_id,
  f.vendedor_id,
  i.sku,
  COALESCE(p_direto.descricao, p_alias.descricao, i.descricao) AS nome_produto,
  date_trunc('month', f.data_emissao)::date AS mes,
  sum(i.valor_total) AS faturamento,
  count(DISTINCT f.numero_nf) AS nfs
FROM alwayson_faturamento f
JOIN alwayson_faturamento_itens i ON i.faturamento_id = f.id
LEFT JOIN alwayson_produtos p_direto ON p_direto.id = i.produto_id
LEFT JOIN alwayson_faturamento_produto_de_para depara
  ON depara.sku_origem = i.sku AND i.produto_id IS NULL
LEFT JOIN alwayson_produtos p_alias ON p_alias.sku = depara.sku_fornecedor
GROUP BY 1, 2, 3, 4, 5, 6;
```

Query de validação usada (sem a Parte B ainda, já que a tabela de-para não
existe no banco no momento deste spec — o `depara`/`p_alias` acima é
projeção, não testado ao vivo):

```sql
-- Testado: 9484 linhas, 36 skus, fat_total = controle = 15104043.07
```

Sem fetch novo de linha crua: o hook segue o mesmo padrão de
`useSerieHierarquia` — paginação obrigatória (`carregarPaginado`, mesmo
motivo de sempre: sem `ORDER BY` explícito antes de `.range()`, o Postgres
não garante estabilidade entre páginas), filtro de hierarquia client-side
sobre as linhas já carregadas.

### Onde entra na tela

Sexta aba, ao lado de Cliente, mesma barra de filtros globais
(Distribuidor/Janela/Comparar/Métrica). Mesma composição de
`EvolucaoGraficoNivel` (top 5 SKUs + "Outros") acima da tabela, igual
Gerência/Supervisão/Vendas.

## Parte B — Curadoria de SKU órfão

### Decisões

1. **De-para table, não backfill.** Mesma forma exata do Insights: uma
   tabela nova mapeia SKU de origem → SKU do catálogo; a resolução acontece
   na leitura (view acima), nunca escrevendo em
   `alwayson_faturamento_itens`. Elimina a necessidade de Edge
   Function/service_role.
2. **Global por fornecedor, sem `distribuidor_id`.** Um SKU físico é o mesmo
   produto não importa qual distribuidor vende — mesmo padrão do
   `alwayson_insights_produto_de_para`, que também não tem `distribuidor_id`.
3. **Só alias — nunca cria produto novo.** Segue `AdminInsightsDeParaProdutos`
   à risca: o SKU de destino precisa já existir em `alwayson_produtos`,
   validado em tempo real no formulário. Sem isso, o admin cadastra o
   produto novo via SQL manual antes de poder aliasar — fluxo que já existe
   hoje, fora de escopo aqui.
4. **RLS: admin global + `gestor_fornecedor` do fornecedor dono.** Mais
   restrita que o precedente do Insights, que é aberto a qualquer
   `authenticated` — lá é um mapa de código de baixo risco; aqui, embora a
   tabela de-para em si também seja "só um mapa", ela decide a identidade do
   produto que aparece no catálogo consolidado, então mantém o mesmo padrão
   de escopo por fornecedor que a migration 048 já estabeleceu para leitura.

### Schema

```sql
CREATE TABLE alwayson_faturamento_produto_de_para (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_origem     text NOT NULL UNIQUE,
  sku_fornecedor text NOT NULL REFERENCES alwayson_produtos(sku)
                   ON UPDATE CASCADE ON DELETE RESTRICT,
  criado_por     uuid REFERENCES auth.users(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- RLS: leitura para quem já vê o fornecedor (mesma função da migration 048);
-- escrita para admin global ou gestor_fornecedor do fornecedor do SKU alvo.
-- A verificação do fornecedor exige resolver sku_fornecedor -> alwayson_produtos
-- -> fornecedor_tenant_id -> current_user_fornecedores_visiveis(), no WITH CHECK.
```

⚠️ Sem `ativo`/soft-delete nesta entrega — desfazer um alias errado é
`DELETE`, restrito ao mesmo escopo de quem insere. Se "desconsiderar sem
apagar" (como o Insights tem) fizer falta na prática, é extensão pequena
depois.

### UI

Nova seção em `/admin/produtos` (a aba já existe, hoje só leitura), no
mesmo formato de "Não mapeados" do `AdminInsightsDeParaProdutos.tsx`: lista
de SKUs com `produto_id IS NULL` e sem entrada na nova de-para, ordenada por
faturamento, cada linha com um campo de texto validado em tempo real contra
`alwayson_produtos.sku` (mesma UX verde/âmbar), botão "Vincular".

Query da fila de pendentes — mesma forma do `WHERE sku_industria IS NULL`
do Insights, adaptada:

```sql
SELECT i.sku, i.descricao, sum(i.valor_total) AS faturamento, count(*) AS linhas
FROM alwayson_faturamento_itens i
WHERE i.produto_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM alwayson_faturamento_produto_de_para d
    WHERE d.sku_origem = i.sku
  )
GROUP BY i.sku, i.descricao
ORDER BY faturamento DESC;
```

⚠️ Agrupar por `(sku, descricao)`, não só `sku`, produziria duplicatas —
achamos em 2026-08-11 que a mesma SKU pode ter `descricao` diferente entre
uploads (ex.: `220823` com dois textos distintos). A query de pendentes
agrupa só por `sku`; se precisar mostrar uma descrição de referência, usar
`max(i.descricao)` ou a mais recente por data, não agrupar por ela.

## Fora de escopo

- Cadastro de produto novo pela UI — continua SQL manual.
- Categoria/marca como filtro na aba Produtos.
- Métrica de quantidade/volume.
- Curva de Pareto / % de mix — fica para depois, se a leitura de evolução
  não for suficiente sozinha.
- Soft-delete/"desconsiderar" na curadoria.
- Corrigir o rótulo enganoso de "Itens Vendidos" nas outras 5 abas.

## Critérios de sucesso

1. A aba Produtos mostra os 36 SKUs reais, nenhum invisível — os 7 órfãos
   aparecem com o nome cru de `alwayson_faturamento_itens`, não em branco.
2. Filtrar por um vendedor específico estreita a lista de SKUs para os que
   ele realmente vendeu.
3. Um admin ou gestor do fornecedor consegue aliasar um SKU órfão futuro
   (não um dos 7 de hoje, que não têm alvo) a um SKU existente, e ele some
   da fila de pendentes.
4. Um usuário sem papel de admin/gestor daquele fornecedor não consegue
   gravar na tabela de-para (RLS bloqueia, não só a UI).
5. O total de faturamento da aba Produtos bate exatamente com o total de
   `alwayson_faturamento_itens` para o mesmo período — nenhum SKU contado
   duas vezes, nenhum perdido.
