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
- **Schema pronto, sem dado carregado ainda:** `alwayson_metas_distribuidor`, `alwayson_performance_periodo`, `alwayson_estoque_distribuidor`, módulo Excelência (`excelencia_config`/`_clientes`/`_criterios`).
- **`docs/superpowers/plans/2026-04-27-insights-connection-and-roadmap.md` está desatualizado** — descreve Insights e a Ponte Performance como roadmap/Fase 2, mas ambos já foram entregues. Trate como histórico, não como fonte de verdade do que falta.
- **Convenção de RLS:** SELECT liberado a `authenticated` (`USING (true)`) na maioria das tabelas `alwayson_*` — uma única policy por tabela/ação, sem duplicar (migration `043` limpou duplicatas herdadas do clone de schema `kgzy`). Escrita em dado sensível/administrativo (tenants, memberships, distribuidores, ajustes de cadastro) é gated por `public.current_user_is_admin()`, seguindo o padrão das migrations `028`/`035`/`044`. Escrita em tabelas centrais de negócio (`clientes_distribuidor`, `vendedores_distribuidor`, `faturamento*`) não tem policy de INSERT/UPDATE para `authenticated` — só `service_role` (ingestão Railway) escreve ali. Ao criar uma tabela nova, siga esse padrão em vez de reintroduzir nomes de policy duplicados.
- **Ajustes de cadastro** (`AdminAjustesCadastro`, `HistoricoAjustesCard`) usa `alwayson_clientes_ajustes_cadastro` real (migration `044` + hook `src/hooks/useAjustesCadastro.ts`) — não é mais mock em memória.
- **Sem testes automatizados** (nenhum vitest/jest, nenhum `*.test.*`). Validação de mudança de frontend é manual: `npm run dev` + browser.
