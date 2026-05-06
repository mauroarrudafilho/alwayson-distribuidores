# Reestruturação da Plataforma AlwaysOn Distribuidores

**Data:** 2026-03-14
**Status:** Aprovado pelo usuário

## Contexto e Motivação

A plataforma atual possui 8 rotas (Dashboard, Distribuidores lista/detalhe, Performance, Excelência, Metas, Estoque, Ingestão) com informações fragmentadas entre telas. O executivo de campo precisa navegar entre 4-5 páginas para montar o raciocínio de uma reunião com o distribuidor.

**Problemas identificados:**
- Performance e Metas são telas separadas, mas conceitualmente dependentes
- Distribuidores é uma tela de cadastro exposta como item operacional — não é função do executivo
- Não existe visão hierárquica por profundidade (gerência → supervisão → vendas → cliente)
- Não existe detalhe transacional individual do cliente
- Excelência mostra dados rasos, sem scorecard por critério
- Estoque não calcula estoque mínimo dinâmico nem leva em conta S&OP

**Objetivo:** Reorganizar a plataforma com fluxo lógico linear para reuniões, menos telas, menos cliques, mais contexto por tela. Separar claramente funções operacionais (executivo) de administrativas (gestor).

## Nova Estrutura de Navegação

### Sidebar (7 itens)

| # | Item | Ícone | Rota | Público-alvo |
|---|------|-------|------|--------------|
| 1 | Dashboard | LayoutDashboard | `/` | Executivo |
| 2 | Performance | TrendingUp | `/performance` | Executivo |
| 3 | Excelência | Award | `/excelencia` | Executivo |
| 4 | Clientes | UserSearch | `/clientes` | Executivo |
| 5 | Estoque | Package | `/estoque` | Executivo |
| — | *separador visual* | — | — | — |
| 6 | Administração | Settings | `/admin` | Gestor/Admin |
| 7 | Ingestão | Upload | `/ingestao` | Gestor/Admin |

### Rotas removidas
- `/distribuidores` — funcionalidade migra para `/admin`
- `/distribuidores/:id` — funcionalidade migra para `/performance` (drill-down hierárquico)
- `/metas` — absorvida por `/performance` (metas integradas em cada nível)

### Rotas novas
- `/clientes` — busca de clientes por CNPJ/nome
- `/clientes/:id` — detalhe transacional individual
- `/admin` — Cockpit de Parâmetros

## 1. Dashboard

**Sem alterações.** Mantém KPIs gerais, ranking, alertas e últimos relatórios.

## 2. Performance (Peça Central)

### Conceito
Página com tabs representando níveis de profundidade hierárquica do distribuidor. Cada tab oferece visão especializada com KPIs, metas integradas e tabela com dados do nível. Linhas clicáveis fazem drill-down para o próximo nível.

### Filtros globais (topo da página)
- Distribuidor (obrigatório a partir do segundo nível)
- Período

### Tabs hierárquicas

| Tab | Filtros adicionais | KPIs | Tabela | Clique na linha |
|-----|-------------------|------|--------|-----------------|
| **Distribuidor** | — | Faturamento, Positivação, Itens, Meta vs Realizado | Lista de distribuidores com métricas agregadas | → Tab Gerência com filtro do distribuidor |
| **Gerência** | Distribuidor | Idem, scoped ao distribuidor | Gerentes do distribuidor | → Tab Supervisão com filtro do gerente |
| **Supervisão** | Distribuidor, Gerente | Idem, scoped ao gerente | Supervisores do gerente | → Tab Vendas com filtro do supervisor |
| **Vendas** | Distribuidor, Gerente, Supervisor | Idem, scoped ao supervisor | Vendedores do supervisor | → Tab Cliente com filtro do vendedor |
| **Cliente** | Distribuidor, Gerente, Supervisor, Vendedor | Idem, scoped ao vendedor | Clientes do vendedor | → Navega para `/clientes/:id` |

### Metas integradas
- Cada tab inclui um card KPI de "Meta vs Realizado" com barra de progresso
- A meta é contextual ao nível ativo e ao escopo filtrado
- Cada linha da tabela pode exibir mini-barra de atingimento

### Mecânica de drill-down
1. Ao clicar numa linha (ex: Gerente João), o sistema:
   - Muda para a próxima tab (Supervisão)
   - Aplica o filtro "Gerente: João" automaticamente
   - Atualiza KPIs para o escopo do Gerente João
2. Breadcrumb contextual abaixo das tabs: `Distribuidor ABC > Gerente João > Supervisor Pedro`
   - Clicável — volta para o nível correspondente com o filtro correto
3. Tabs também são acessíveis diretamente com filtros manuais (dois caminhos para mesma informação)

### Tabs adaptativas
- Se o distribuidor não tem gerentes, a tab Gerência fica desabilitada/oculta
- O sistema se adapta à estrutura real de cada distribuidor

## 3. Excelência (Clientes Estratégicos)

### Conceito
Monitoramento de clientes elegíveis ao plano de excelência contra critérios pré-definidos. Visão 360 exclusiva dos clientes estratégicos.

### Filtros
- Distribuidor
- Status (Todos / Aderentes / Em risco / Fora do padrão)

### KPIs do topo
- Total de clientes no plano
- Clientes com 100% de aderência
- Clientes em risco (1+ critério amarelo/vermelho)
- Clientes fora do padrão

### Tabela de acompanhamento
Colunas dinâmicas baseadas nos critérios cadastrados no Cockpit de Parâmetros:

| Cliente | Frequência | Mix | Volume | Itens | Score |
|---------|-----------|-----|--------|-------|-------|
| ABC Ltda | 🟢 4/4 | 🟡 6/8 | 🟢 OK | 🟢 12 | 85% |
| DEF Ltda | 🔴 2/4 | 🟡 5/8 | 🔴 -30% | 🟢 10 | 62% |

- Células com cor de fundo sutil (verde/amarelo/vermelho)
- Score = % de aderência geral
- Ordenável por qualquer coluna
- Clicar na linha → `/clientes/:id`
- Colunas de critérios são dinâmicas — vêm dos critérios configurados no Cockpit

### Relação com Cockpit de Parâmetros
- Admin cadastra em Administração > Excelência:
  - Critérios do plano (frequência mínima, mix mínimo, volume, quantidade de itens, etc.)
  - Lista de clientes elegíveis por distribuidor
- A página de Excelência apenas monitora — não configura

## 4. Clientes (Detalhe Transacional)

### Página `/clientes` — Busca

- Campo de busca por CNPJ, razão social ou nome fantasia
- Tabela de resultados: Nome Fantasia, Razão Social, CNPJ, Cidade
- Clicar na linha → `/clientes/:id`

### Página `/clientes/:id` — Detalhe

**Cabeçalho:** Nome do cliente, CNPJ, Cidade-UF, Vendedor responsável, Distribuidor

**KPIs:**
- Faturamento total (acumulado)
- Ticket médio
- Frequência de compra (faturamentos/mês)
- Data da última compra

**Seções:**

#### Evolução de Faturamento
- Gráfico de linha: faturamento mês a mês (últimos 6-12 meses)

#### Histórico de Notas Fiscais
- Tabela cronológica reversa
- Colunas: Data, Nº NF, Itens, Valor Total
- Expansível: ao clicar mostra os produtos da nota (SKU, quantidade, valor unitário)

#### Produtos Mais Comprados
- Ranking por volume total
- Colunas: Produto, Qtd Total, Frequência, Última Compra

### Dois caminhos de acesso
1. Drill-down pelo Performance (tab Cliente → clica no cliente)
2. Busca direta na página `/clientes`

## 5. Estoque (Assistente de Supply Chain)

### Conceito
Visão de supply chain com estoque mínimo dinâmico e sugestão inteligente de pedidos baseada em S&OP.

### Filtros
- Distribuidor
- Status (Todos / Crítico / Saudável / Overstock)
- **Período de referência** — período de vendas que influencia o cálculo de sugestão (ex: "Jun/2025", "Últimos 3 meses", range customizável)

### KPIs do topo
- SKUs total
- SKUs críticos (abaixo do mínimo)
- SKUs overstock
- Sugestões de pedido ativas

### Tabela de posição

| SKU | Descrição | Qtd Atual | Est. Mínimo | Dias Cobertura | Sugestão Pedido | Status |
|-----|-----------|-----------|-------------|----------------|-----------------|--------|
| 001 | Prod A | 500 | 200 | 15d | — | 🟢 |
| 002 | Prod B | 80 | 150 | 4d | 300 | 🔴 |
| 003 | Prod C | 900 | 100 | 45d | — | 🟡 |

### Estoque Mínimo (nova coluna)
- Calculado automaticamente a partir do histórico de sell-out do produto naquele distribuidor
- Base: média diária de vendas × margem de segurança
- É informação viva — atualiza conforme novos dados entram

### Sugestão de Pedido (S&OP)
```
Sugestão = (Média diária de vendas no período selecionado × Lead time em dias)
           + Estoque de segurança
           - Estoque atual
```
- Se resultado ≤ 0: sem sugestão (estoque suficiente)
- Média diária de vendas: calculada a partir do **período de referência selecionado pelo usuário**
- Lead time padrão da indústria: configurável no Cockpit de Parâmetros (futuro)
- Período selecionável permite ajustar por sazonalidade (ex: basear pedido de junho no histórico de junho do ano passado)

### Status
- 🔴 Crítico: abaixo do estoque mínimo
- 🟢 Saudável: entre mínimo e X dias de cobertura
- 🟡 Overstock: acima de X dias de cobertura

## 6. Administração (Cockpit de Parâmetros)

### Conceito
Centraliza toda configuração e parametrização do sistema. Separado das telas operacionais. Acesso do gestor/admin.

### Sub-tabs

| Sub-tab | Funcionalidade |
|---------|---------------|
| **Distribuidores** | CRUD de distribuidores (migrado de `/distribuidores`). Cadastro, edição, ativar/desativar, dados cadastrais (CNPJ, cidade, estado, responsável) |
| **Produtos** | Cadastro de SKUs do portfólio. Descrição, categoria, preço referência. Base para análise de mix e estoque |
| **Metas** | Configuração de metas por hierarquia. Valor-meta por distribuidor/gerente/supervisor/vendedor. Tipo (faturamento, volume, positivação) e período |
| **Excelência** | Cadastro dos critérios do plano e gestão da lista de clientes elegíveis por distribuidor |
| **Usuários** | Gestão de acessos ao sistema. Caso de uso concreto: criar acesso para lideranças dos distribuidores com visão restrita aos dados do seu distribuidor |

### Modelo de acesso (futuro)
- **Executivo AlwaysOn** — acesso total, todos os distribuidores
- **Liderança do Distribuidor** — acesso restrito aos dados do próprio distribuidor

## 7. Ingestão (Ajuste Menor)

### Mudanças

#### Download de template
- Botão "Baixar Template" ao lado do upload
- Gera/baixa o Excel modelo para o tipo selecionado
- Templates já existem em `docs/templates/` — servir via `public/`

#### Novo tipo de upload: Notas Fiscais
O tipo existente "Vendas" (`RelatorioIngestao.tipo = 'vendas'`) passa a ser interpretado como **upload de faturamento**. A ingestão de vendas já recebe dados transacionais — o parsing muda para popular `alwayson_faturamento` + `alwayson_faturamento_itens` ao invés de (ou além de) `alwayson_performance_periodo`.

- `RelatorioIngestao.tipo` permanece `'vendas'` (sem mudança no enum)
- O parser de vendas passa a criar registros em `alwayson_faturamento` e `alwayson_faturamento_itens`
- `alwayson_performance_periodo` pode ser computado como view materializada a partir do faturamento, ou continuar sendo populado em paralelo na ingestão (decisão de implementação)
- Template de vendas atualizado para incluir campos: número NF, data emissão, CNPJ cliente, SKU, quantidade, valor unitário

## Arquitetura Técnica

### Stack (sem mudanças)
- React 19 + Vite 7 + TypeScript
- Tailwind 4 + Shadcn UI
- TanStack Query + Supabase
- React Router 7

### Abordagem: Performance como Hub com Contexto Propagado
- Estado hierárquico (distribuidor, gerente, supervisor, vendedor selecionados) gerenciado via React state local + URL params na página Performance
- Drill-down propaga filtros entre tabs sem necessidade de state management global
- Navegação para `/clientes/:id` é saída do contexto Performance — dados do cliente carregam independentemente

### URL State Schema (Performance)
O estado do drill-down é refletido na URL para permitir deep-linking e compartilhamento:
```
/performance?tab=supervisao&distribuidor=<id>&gerente=<id>
/performance?tab=vendas&distribuidor=<id>&gerente=<id>&supervisor=<id>
/performance?tab=cliente&distribuidor=<id>&vendedor=<id>
```
- `tab`: nível ativo (distribuidor | gerencia | supervisao | vendas | cliente)
- Filtros de hierarquia como query params opcionais
- Navegação browser back/forward funciona entre estados de drill-down
- Período é query param adicional: `&periodo_inicio=2026-01&periodo_fim=2026-03`

### Roteamento da Administração
Sub-tabs da Administração são rotas aninhadas para permitir deep-linking:
```
/admin                  → redireciona para /admin/distribuidores
/admin/distribuidores
/admin/produtos
/admin/metas
/admin/excelencia
/admin/usuarios
```

### Filtro de Período
- **Formato:** range de meses (mês/ano início — mês/ano fim)
- **Default:** mês corrente
- **Seletor:** calendário mensal com range picker
- **Aplicação:** afeta tanto KPIs quanto tabelas do nível ativo
- **Interação com dados:** filtra registros de `PerformancePeriodo` onde `periodo_inicio >= filtro_inicio AND periodo_fim <= filtro_fim`

## Modelo de Dados — Mudanças Necessárias

### Tabelas existentes (mantidas)
- `alwayson_distribuidores` — sem mudanças de schema
- `alwayson_vendedores_distribuidor` — sem mudanças (hierarquia via `tipo` + `supervisor_id`)
- `alwayson_clientes_distribuidor` — sem mudanças
- `alwayson_performance_periodo` — sem mudanças (dados agregados por vendedor+período)
- `alwayson_metas_distribuidor` — sem mudanças (já possui `hierarquia` e `vendedor_id`)
- `alwayson_relatorios_ingestao` — sem mudanças

### Tabelas novas

#### `alwayson_produtos`
Catálogo de SKUs do portfólio. Global (não por distribuidor).

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid | PK | |
| sku | text | sim | Código do produto |
| descricao | text | sim | Nome/descrição |
| categoria | text | não | Categoria do produto |
| preco_referencia | numeric | não | Preço tabela referência |
| ativo | boolean | sim | Default true |
| criado_em | timestamptz | sim | Default now() |

#### `alwayson_faturamento`
Histórico de faturamento por cliente. Fonte primária para detalhe transacional.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid | PK | |
| distribuidor_id | uuid | FK | → alwayson_distribuidores |
| cliente_id | uuid | FK | → alwayson_clientes_distribuidor |
| vendedor_id | uuid | FK | → alwayson_vendedores_distribuidor |
| numero_nf | text | sim | Número da nota fiscal |
| data_emissao | date | sim | Data de emissão |
| valor_total | numeric | sim | Valor total da NF |
| criado_em | timestamptz | sim | Default now() |

#### `alwayson_faturamento_itens`
Itens de cada registro de faturamento. Detalhe por SKU.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid | PK | |
| faturamento_id | uuid | FK | → alwayson_faturamento |
| produto_id | uuid | FK, opcional | → alwayson_produtos (se catalogado) |
| sku | text | sim | Código SKU (sempre presente, mesmo sem produto_id) |
| descricao | text | sim | Descrição do item |
| quantidade | numeric | sim | Quantidade |
| valor_unitario | numeric | sim | Preço unitário |
| valor_total | numeric | sim | Quantidade × valor_unitario |

#### `alwayson_excelencia_config`
Configuração dos critérios de excelência por distribuidor. Cadastrado no Cockpit de Parâmetros.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid | PK | |
| distribuidor_id | uuid | FK | → alwayson_distribuidores |
| criterio_nome | text | sim | Nome livre do critério (ex: "Frequência", "Mix", "Volume") |
| meta_valor | numeric | sim | Valor-alvo do critério |
| tipo_comparacao | text | sim | 'min' (≥ meta) ou 'max' (≤ meta) |
| ativo | boolean | sim | Default true |
| ordem | integer | sim | Ordem de exibição na tabela |
| criado_em | timestamptz | sim | Default now() |

#### `alwayson_excelencia_clientes`
Lista de clientes elegíveis ao plano de excelência por distribuidor.

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| id | uuid | PK | |
| distribuidor_id | uuid | FK | → alwayson_distribuidores |
| cliente_id | uuid | FK | → alwayson_clientes_distribuidor |
| ativo | boolean | sim | Default true |
| adicionado_em | timestamptz | sim | Default now() |

### Tabelas modificadas

#### `alwayson_estoque_distribuidor` — nova coluna + status atualizado
- **`estoque_minimo_calculado`** (numeric, nullable): estoque mínimo dinâmico, calculado a partir do histórico de sell-out
- **`quantidade_minima`** (existente): mantida como **override manual**. Se preenchida e `estoque_minimo_calculado` for null (sem histórico de vendas), usa `quantidade_minima` como fallback
- **Prioridade**: `estoque_minimo_calculado ?? quantidade_minima` — o dinâmico prevalece quando disponível
- **`status`**: migrar de `'normal' | 'baixo' | 'critico' | 'ruptura'` para `'saudavel' | 'critico' | 'overstock'`
  - `critico`: quantidade_atual < estoque_efetivo (onde estoque_efetivo = `estoque_minimo_calculado ?? quantidade_minima`)
  - `saudavel`: estoque normal (entre mínimo e 60 dias de cobertura)
  - `overstock`: acima de 60 dias de cobertura
- **Migração de enum**: `normal → saudavel`, `baixo → critico`, `critico → critico`, `ruptura → critico`

#### `alwayson_distribuidores` — nova coluna
- **`lead_time_dias`** (integer, default 7): lead time padrão de entrega da indústria até o distribuidor, usado no cálculo de sugestão S&OP

### Unique Constraints (novas tabelas)
- `alwayson_produtos`: UNIQUE(`sku`)
- `alwayson_faturamento`: UNIQUE(`distribuidor_id`, `numero_nf`)
- `alwayson_excelencia_clientes`: UNIQUE(`distribuidor_id`, `cliente_id`)

### Tabela existente que será descontinuada
- `alwayson_excelencia_criterios` — substituída por `alwayson_excelencia_config` + `alwayson_excelencia_clientes` + dados calculados a partir do faturamento
- **Migração**: dados existentes de critérios por cliente são arquivados (backup) e não migrados — o novo modelo recalcula tudo a partir do faturamento e da nova configuração

### Views Supabase recomendadas

#### `view_hierarquia_vendedores`
CTE recursiva que resolve a árvore hierárquica completa:
```sql
-- Retorna: vendedor_id, distribuidor_id, nome, tipo, gerente_id, gerente_nome, supervisor_id, supervisor_nome
-- Permite consultar todos os vendedores com seus superiores resolvidos em uma query flat
```

#### `view_performance_por_nivel`
Agregação de performance por nível hierárquico:
```sql
-- Dado um distribuidor_id e período, retorna faturamento/positivação/itens agregados por:
-- gerente, supervisor, vendedor ou cliente
```

#### `view_estoque_sugestao`
Cálculo de estoque mínimo e sugestão de pedido:
```sql
-- Combina estoque atual + histórico de vendas (faturamento) + lead_time do distribuidor
-- Retorna: sku, qtd_atual, estoque_minimo, dias_cobertura, sugestao_pedido, status
```

## Lógica de Hierarquia — Tabs Adaptativas

### Regra de skip
A hierarquia de um distribuidor pode não ter todos os níveis. O sistema se adapta:

1. **Ao carregar Performance com um distribuidor selecionado**, verificar quais `tipo` de vendedores existem para aquele distribuidor
2. **Tabs visíveis** = apenas os níveis que possuem pelo menos um registro ativo + tab Distribuidor (sempre visível) + tab Cliente (sempre visível)
3. **Drill-down** pula para o próximo nível **existente**:
   - Se distribuidor não tem gerentes → clique no distribuidor vai para Supervisão (ou Vendas se não tem supervisores)
   - Se não tem gerentes NEM supervisores → vai direto para Vendas
4. **Breadcrumb** mostra apenas os níveis presentes no caminho percorrido

### Exemplo
- Distribuidor A tem gerentes, supervisores e vendedores → 5 tabs
- Distribuidor B só tem supervisores e vendedores → 4 tabs (Distribuidor, Supervisão, Vendas, Cliente)
- Distribuidor C só tem vendedores → 3 tabs (Distribuidor, Vendas, Cliente)

## KPI Aggregation — Regras por Nível

### Performance tab Distribuidor
- Query: `alwayson_performance_periodo` grouped by `distribuidor_id`, sum de faturamento/positivados/itens
- Meta: `alwayson_metas_distribuidor` where `hierarquia = 'distribuidor'`

### Performance tab Gerência
- Identificar vendedores com `tipo = 'gerente'` do distribuidor selecionado
- Para cada gerente, somar performance de todos os vendedores subordinados (recursivo via `supervisor_id`)
- Meta: `alwayson_metas_distribuidor` where `hierarquia = 'gerente'` e `vendedor_id = gerente_id`

### Performance tab Supervisão
- Identificar vendedores com `tipo = 'supervisor'` subordinados ao gerente selecionado (ou todos se sem filtro)
- Para cada supervisor, somar performance dos vendedores diretos
- Meta: idem com `hierarquia = 'supervisor'`

### Performance tab Vendas
- Vendedores (`tipo = 'vendedor'`) subordinados ao supervisor selecionado
- Performance direta do registro individual
- Meta: idem com `hierarquia = 'vendedor'`

### Performance tab Cliente
- Clientes do vendedor selecionado (via `cliente.vendedor_id`)
- Faturamento por cliente: derivado de `alwayson_faturamento` agrupado por `cliente_id` no período

### Estratégia de computação
- **Preferência por views Supabase** para níveis com recursão (gerência, supervisão)
- **Client-side aggregation** aceitável para vendas e cliente (poucos registros por escopo)
- TanStack Query com `staleTime` generoso (dados de performance não mudam em tempo real)

## Excelência — Score e Thresholds

### Fórmula do Score
```
Score = (critérios atingidos / total critérios ativos) × 100
```
- Ponderação simples (todos os critérios têm peso igual) — V1
- Peso por critério pode ser adicionado futuramente via coluna `peso` na `alwayson_excelencia_config`

### Thresholds de status por critério
- 🟢 Verde: realizado ≥ meta_valor (atingido)
- 🟡 Amarelo: realizado ≥ 70% da meta_valor (em risco)
- 🔴 Vermelho: realizado < 70% da meta_valor (fora do padrão)

### Cálculo dos valores realizados
Derivados automaticamente a partir dos dados de faturamento e do cadastro de clientes:
- **Frequência**: count de registros distintos de faturamento no período / meses no período
- **Mix (itens distintos)**: count distinct SKUs no faturamento do período
- **Volume**: sum valor_total do faturamento do período
- **Itens cadastrados**: campo `itens_cadastrados` de `alwayson_clientes_distribuidor`

## Estoque — S&OP Detalhamento

### Dias de Cobertura
```
Dias cobertura = Estoque atual / Média diária de vendas (últimos 90 dias)
```
- Se média diária = 0 (sem vendas), dias cobertura = ∞ (exibe "—" na UI)
- Usado para determinar status: overstock se > 60 dias

### Estoque Mínimo
```
Estoque mínimo = Média diária de vendas (últimos 90 dias) × Fator de segurança (1.5)
```
- Recalculado periodicamente (diário ou na ingestão de dados)
- Média diária de vendas: sum(quantidade) de `alwayson_faturamento_itens` por SKU nos últimos 90 dias / 90
- Fallback: se não há histórico de faturamento, usa `quantidade_minima` (manual) do cadastro

### Sugestão de Pedido
```
Sugestão = (Média diária de vendas no período selecionado × Lead time em dias) + Estoque de segurança - Estoque atual
```
- **Período selecionado pelo usuário** — filtro na tela que define a base de cálculo
- **Lead time**: `alwayson_distribuidores.lead_time_dias` (default: 7 dias)
- **Estoque de segurança**: estoque_minimo_calculado ?? quantidade_minima
- Se resultado ≤ 0: sem sugestão

## Auth e Controle de Acesso

### Fase atual (V1)
- Sem autenticação completa — plataforma usada internamente pelo executivo
- Administração não é protegida por role-based access nesta fase
- Foco em funcionalidade, não em controle de acesso

### Preparação para V2
- Estrutura de Usuários no Cockpit fica como **placeholder funcional** (tela existe, CRUD básico, sem enforcement)
- Quando ativado, usar Supabase Auth + RLS policies
- Modelo: `executivo_alwayson` (acesso total) vs `lideranca_distribuidor` (acesso filtrado por `distribuidor_id`)

## UX: Loading, Error e Empty States

### Loading
- Skeleton screens em KPIs e tabelas (padrão já existente no projeto)
- Tabs carregam sob demanda (lazy) — só busca dados quando ativada

### Empty States
- Distribuidor sem dados de performance: mensagem contextual + CTA para ingestão
- Busca de clientes sem resultado: "Nenhum cliente encontrado para este CNPJ/nome"
- Tab sem dados no nível (ex: sem gerentes): tab desabilitada com tooltip explicativo

### Error States
- Erro de query: mensagem discreta com botão "Tentar novamente" (retry via TanStack Query)
- Erro de ingestão: detalhamento no histórico de uploads

## Impacto no Dashboard

Dashboard não muda funcionalmente, mas pode precisar de ajustes menores:
- Query de estoque crítico: atualizar filtro de status de `['critico', 'ruptura']` para `['critico']` (novo enum)
- Restante dos KPIs e queries não é afetado pelas mudanças de schema

## Busca de Clientes (`/clientes`)

- **Mínimo 3 caracteres** antes de buscar
- **Debounce** de 300ms no input
- **Query**: Supabase `ilike` em `cnpj`, `razao_social` e `nome_fantasia`
- **Paginação**: 50 resultados por página, scroll infinito ou paginação com botões
- **Sem filtro de distribuidor**: busca global — o executivo vê clientes de todos os distribuidores

## Resumo de Impacto

| Área | Tipo de mudança |
|------|----------------|
| Dashboard | Ajuste menor (query estoque) |
| Performance | Reescrita total |
| Excelência | Reescrita |
| Clientes | Página nova |
| Estoque | Evolução significativa |
| Administração | Página nova |
| Ingestão | Ajuste menor |
| Distribuidores (lista/detalhe) | Removidas |
| Metas (página própria) | Removida |

## Novas Tabelas Supabase

| Tabela | Tipo |
|--------|------|
| `alwayson_produtos` | Nova |
| `alwayson_faturamento` | Nova |
| `alwayson_faturamento_itens` | Nova |
| `alwayson_excelencia_config` | Nova |
| `alwayson_excelencia_clientes` | Nova |

## Colunas Adicionadas

| Tabela | Coluna | Tipo |
|--------|--------|------|
| `alwayson_estoque_distribuidor` | `estoque_minimo_calculado` | numeric |
| `alwayson_distribuidores` | `lead_time_dias` | integer (default 7) |

## Tabela Descontinuada

| Tabela | Substituída por |
|--------|----------------|
| `alwayson_excelencia_criterios` | `alwayson_excelencia_config` + `alwayson_excelencia_clientes` + faturamento |
