# AlwaysOn Distribuidores — contexto para assistentes

## Supabase (único projeto canônico deste repositório)

| | |
|--|--|
| **Project ref** | `osukbalwykbqvoumddxz` |
| **URL da API** | `https://osukbalwykbqvoumddxz.supabase.co` |

- Migrations em `docs/migrations/` e dados operacionais das tabelas `alwayson_*` vivem **somente** neste projeto.
- Ao usar Supabase MCP, CLI (`supabase link`) ou SQL Editor, confira no dashboard que o **ref** é **`osukbalwykbqvoumddxz`** antes de executar DDL/DML.
- **Não usar** o ref legado `kgzybpelluftexrewyke` para este produto: não há mais tabelas `alwayson_*` lá; apontar app, Railway ou scripts para ele quebra o fluxo.

Documentação detalhada: [`docs/SUPABASE_PROJECT.md`](docs/SUPABASE_PROJECT.md).

Visão de produto e fases futuras: [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Estado atual (atualizado 2026-08-01)

Snapshot rápido para qualquer agente que chegue neste repo sem contexto prévio — confirme direto no banco (`mcp__Supabase__list_tables` / `list_migrations`) antes de assumir que algo aqui ainda está atual.

- **Em produção com dado real:** Dashboard, Performance, Clientes/Cliente Detalhe, Estoque, Ingestão, Excelência e **Insights** (sell-out territorial — ~49k NFs, ~173k itens, views agregadas no Postgres, aba Território/Clientes/Redes/Produtos, per capita via IBGE, de-para de produto, redes manuais). A Ponte Performance↔Insights (`InsightsBadge` + `InsightsBateOlhoModal`) também está em produção.
- **⚠️ As duas bases têm naturezas diferentes — não as confunda:**
  - **Insights = histórico fechado da operação de distribuição *anterior* do grupo.** Janela **jan/2022 – dez/2024** (36 meses), 8.438 CNPJs, e **não recebe dado novo**. Serve a consulta/benchmark territorial e apoio ao executivo. A UI rotula como `histórico Arruda`; `insightsCicloVivoPeriodo` separa o sell-out corrente (jan/2025 →) do arquivo antigo. **Não trate o cruzamento Insights × carteira de um distribuidor como "clientes a conquistar"** — são CNPJs da operação antiga, possivelmente atendidos por outro parceiro, fora do território ou inativos. Vira alvo comercial só após curadoria.
  - **Sell-in dos distribuidores parceiros = operação corrente, em carga inicial.** Em 2026-08-01 havia **1 upload, de 1 distribuidor** (tipo `vendas`, ref. 2026-05). Números pequenos e "estranhos" nessa base (1 mês só; 100% dos clientes com faturamento) são **artefato do estágio de carga**, não conclusão estrutural — confirme o volume atual antes de tirar conclusões.
- **Ingestão:** há templates distintos por tipo (`vendas`, `estoque`, `clientes`, de-para). O template **`clientes`** grava a carteira em `alwayson_clientes_distribuidor` independentemente de haver nota — é ele que cria o denominador de cobertura/positivação. Arquivo de `vendas` sozinho cria cliente como efeito colateral da nota, então cobertura fica 100% por construção. Reprocessar o mesmo arquivo substitui (não duplica).
- **Schema pronto, sem dado carregado ainda:** `alwayson_metas_distribuidor`, `alwayson_performance_periodo`, `alwayson_estoque_distribuidor`, módulo Excelência (`excelencia_config`/`_clientes`/`_criterios`).
- **Metas (migration `045`):** `valor_realizado` e `percentual_atingimento` **não são mais colunas** — vêm derivados do faturamento pela view `alwayson_metas_v_acompanhamento` (com `security_invoker`). **Leia metas pela view, nunca pela tabela**, senão o atingimento some. A view também expõe `valor_rollup_filhos`/`diferenca_rollup`: a meta de supervisor/gerente é **rollup editável** — a soma dos filhos é sugestão, o valor definido é a autoridade, e a diferença é a meta de venda direta daquele nível. As unique keys são índices **parciais**: `ON CONFLICT` exige repetir o predicado (`WHERE vendedor_id IS NOT NULL`), por isso o hook usa select→update/insert em vez de `.upsert()`.
- **`docs/superpowers/plans/2026-04-27-insights-connection-and-roadmap.md` está desatualizado** — descreve Insights e a Ponte Performance como roadmap/Fase 2, mas ambos já foram entregues. Trate como histórico, não como fonte de verdade do que falta.
- **Convenção de RLS:** SELECT liberado a `authenticated` (`USING (true)`) na maioria das tabelas `alwayson_*` — uma única policy por tabela/ação, sem duplicar (migration `043` limpou duplicatas herdadas do clone de schema `kgzy`). Escrita em dado sensível/administrativo (tenants, memberships, distribuidores, ajustes de cadastro) é gated por `public.current_user_is_admin()`, seguindo o padrão das migrations `028`/`035`/`044`. Escrita em tabelas centrais de negócio (`clientes_distribuidor`, `vendedores_distribuidor`, `faturamento*`) não tem policy de INSERT/UPDATE para `authenticated` — só `service_role` (ingestão Railway) escreve ali. Ao criar uma tabela nova, siga esse padrão em vez de reintroduzir nomes de policy duplicados.
- **Ajustes de cadastro** (`AdminAjustesCadastro`, `HistoricoAjustesCard`) usa `alwayson_clientes_ajustes_cadastro` real (migration `044` + hook `src/hooks/useAjustesCadastro.ts`) — não é mais mock em memória.
- **Dois eixos no dado (migration `047`):** todo arquivo importado é o recorte de **um fornecedor dentro de um distribuidor** — por isso `alwayson_faturamento`, `_relatorios_ingestao`, `_produtos`, `_metas_distribuidor` e `_estoque_distribuidor` carregam `fornecedor_tenant_id` além de `distribuidor_id`. `POST /api/ingest` exige `fornecedor_id` e recusa fornecedor sem relação ativa em `alwayson_fornecedor_distribuidores`. Ficam **sem** carimbo de fornecedor, de propósito: clientes e vendedores (são do distribuidor) e todo o `alwayson_insights_*` (é territorial).
- **Escopo de acesso pretendido** (funções `current_user_fornecedor_tenants()` / `current_user_distribuidores()` já existem; **as policies ainda NÃO usam**): KAM = fornecedor ∈ seus **E** distribuidor ∈ seus; gestor do fornecedor = fornecedor ∈ seus, qualquer distribuidor; distribuidor = o seu, qualquer fornecedor. ⚠️ Hoje as tabelas centrais seguem `SELECT USING (true)` — **qualquer autenticado vê tudo**. Só existe 1 utilizador (admin global), então ninguém está exposto, mas convidar o primeiro KAM ou usuário de distribuidor antes das policies expõe dado de todos os parceiros.
- **Sem testes automatizados** (nenhum vitest/jest, nenhum `*.test.*`). Validação de mudança de frontend é manual: `npm run dev` + browser.
