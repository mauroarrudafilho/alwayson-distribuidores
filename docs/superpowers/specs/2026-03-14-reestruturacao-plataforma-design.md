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
- Frequência de compra (NFs/mês)
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

### Mudança
Adicionar botão de **download de template** para cada tipo de relatório.

- Botão "Baixar Template" ao lado do upload
- Gera/baixa o Excel modelo para o tipo selecionado (Vendas, Estoque, Clientes)
- Templates já existem em `docs/templates/`

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

### Dados: hierarquia existente é suficiente
- `alwayson_vendedores_distribuidor` já possui `tipo` (vendedor/supervisor/gerente) e `supervisor_id` (auto-referência)
- Hierarquia se resolve via queries com joins no `supervisor_id`
- Pode ser necessário ajustar/criar views no Supabase para queries hierárquicas eficientes

### Novas necessidades de dados
- Histórico de NFs por cliente (pode já existir em `alwayson_performance_periodo` ou precisar de nova tabela)
- Critérios de excelência configuráveis (já existe `alwayson_excelencia_criterios`)
- Estoque mínimo calculado (derivado, não necessariamente nova coluna — pode ser computed)
- Lead time por indústria (parâmetro configurável — nova tabela ou coluna em distribuidores)

## Resumo de Impacto

| Área | Tipo de mudança |
|------|----------------|
| Dashboard | Nenhuma |
| Performance | Reescrita total |
| Excelência | Reescrita |
| Clientes | Página nova |
| Estoque | Evolução significativa |
| Administração | Página nova |
| Ingestão | Ajuste menor |
| Distribuidores (lista/detalhe) | Removidas |
| Metas (página própria) | Removida |
