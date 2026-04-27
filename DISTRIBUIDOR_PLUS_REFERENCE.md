# Distribuidor+ — Documento de Referência para Implementação

> **Para o Cursor:** Este documento é a fonte única de verdade para implementar o módulo Distribuidor+ no Arruda Hub. Siga rigorosamente os padrões de design system definidos abaixo. **Não invente tokens, classes ou padrões que não estejam aqui.**

---

## 1. Contexto do Módulo

### O que é o Distribuidor+
Módulo do Arruda Hub para gestão e monitoramento dos distribuidores parceiros da Arruda Representações no Nordeste (PE, PB, RN, AL, SE). Centraliza dados que hoje chegam de forma dispersa (relatórios manuais, WhatsApp, planilhas) em uma plataforma estruturada com visibilidade em tempo real.

### Problema que resolve
- Falta de visibilidade de sell-out por vendedor, supervisor e gerência
- Ausência de acompanhamento de clientes estratégicos (Plano de Excelência)
- Sem gestão de metas por hierarquia do distribuidor
- Nenhum controle de estoque/ruptura nos distribuidores
- Cobrança imprecisa por falta de dados confiáveis
- Sem auditoria de campo para validar critérios de excelência no PDV

### Posição no Arruda Hub
Dentro da arquitetura do Hub, este módulo integra o **Core Operacional**, ao lado de Comercial+, Logística e Trade Marketing. A rota base será `/admin/distribuidor`.

### Decisão de Infraestrutura
**Mesmo projeto Supabase do `arruda-hub-commercial-core`.** O módulo usa prefixo `distribuidor_*` nas tabelas para separação lógica, mas compartilha banco, auth e storage. Isso permite cruzar dados nativamente via SQL — ex: JOIN entre pedidos (sell-in via NFe) e performance do distribuidor (sell-out reportado).

### Camadas do Módulo
O Distribuidor+ opera em duas camadas complementares:

1. **Dados Reportados (passivo)** — relatórios enviados pelo distribuidor (sell-out, estoque, positivação). Ingestão via upload de arquivo padronizado no MVP, evoluindo para API.
2. **Field Execution (ativo)** — auditorias de campo realizadas pelo representante Arruda ou promotor do distribuidor nos clientes do Plano de Excelência. Valida na prática o que os números dizem.

---

## 2. Stack Tecnológica

```
React + Vite
TypeScript
Tailwind CSS
Shadcn UI (componentes base)
TanStack Table (tabelas de alta densidade)
React Hook Form + Zod (formulários)
React Query / TanStack Query (data fetching)
Supabase (banco + auth)
Lucide Icons (iconografia)
Recharts (gráficos de performance)
```

> **Atenção:** Não instalar novas dependências sem verificar se já existem no projeto. Preferir reutilizar o que já está no `package.json` do `arruda-hub-commercial-core`.

---

## 3. Design System — Tokens Obrigatórios

> Estes são os tokens do design system de alta densidade já estabelecido no projeto. Todo componente novo **deve** seguir estes padrões.

### 3.1 Espaçamento

| Contexto | Classe correta |
|----------|---------------|
| Card padding | `p-3` (máximo `p-4`) |
| Grid gap padrão | `gap-2` ou `gap-3` |
| Section margin | `mb-4` ou `mb-6` |
| Input / Select height | `h-8` |
| Sidebar header | `px-3 py-3` |
| Menu item height | `h-8` |
| Filtros grid | `gap-3` |

### 3.2 Tipografia

| Elemento | Classe obrigatória |
|----------|-------------------|
| Título de seção / label de card | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Label de formulário / filtro | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block` |
| Valor principal KPI | `text-sm font-bold tabular-nums text-foreground` |
| KPI grande | `text-xl font-semibold tracking-tight` |
| Texto secundário | `text-xs text-muted-foreground` |
| Texto micro | `text-[10px] text-muted-foreground` |
| Badge numérico | `text-[9px]` ou `text-[10px]` |
| Célula de tabela | `text-xs` ou `text-sm` |
| Header de tabela | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground` |

### 3.3 Ícones (Lucide)

| Contexto | Tamanho |
|----------|---------|
| Menu sidebar | `w-3.5 h-3.5` |
| KPI / Card header | `w-3 h-3` |
| Botões compactos | `w-3.5 h-3.5` |
| Input prefix (Search) | `w-3.5 h-3.5` |
| Ação de linha em tabela | `w-3.5 h-3.5` |

### 3.4 Bordas e Sombras

| Elemento | Classe obrigatória |
|----------|-------------------|
| Card padrão | `border border-border/50 rounded-md shadow-none` |
| Card hover | `hover:border-border/80 transition-colors` |
| Card destaque (primary) | `border-primary/20 bg-primary/5 shadow-none rounded-md` |
| Input / Select | `shadow-none border-border/50` |
| Badge status | `rounded-sm` (nunca `rounded-full`) |

---

## 4. Padrões de Componentes — Templates Obrigatórios

### 4.1 Card KPI (usar em toda seção de métricas)

```tsx
<Card className="rounded-md border border-border/50 bg-card hover:border-border/80 transition-colors shadow-none">
  <CardContent className="p-3">
    <div className="flex items-center justify-between gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mb-1.5">
      <span className="flex items-center gap-1.5 truncate">
        <IconName className="h-3 w-3 shrink-0" />
        <span className="truncate">LABEL DO KPI</span>
      </span>
      {badge && (
        <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold rounded-sm shrink-0">
          {badge}
        </Badge>
      )}
    </div>
    <div className="text-sm font-bold tabular-nums text-foreground">{value}</div>
    {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
  </CardContent>
</Card>
```

### 4.2 Badges de Status do Distribuidor

```tsx
// Ativo / Meta atingida
className="bg-emerald-500 text-white border-emerald-600 font-semibold shadow-sm text-[10px] rounded-sm px-1.5 py-0.5"

// Em andamento / Parcial
className="bg-amber-100 text-amber-700 border-amber-300 font-semibold text-[10px] rounded-sm px-1.5 py-0.5"

// Abaixo da meta / Crítico
className="bg-red-50 text-red-700 border-red-200 font-semibold text-[10px] rounded-sm px-1.5 py-0.5"

// Neutro / Sem dados
className="bg-slate-100 text-slate-600 border-slate-300 font-semibold text-[10px] rounded-sm px-1.5 py-0.5"

// Excelência (cliente VIP)
className="bg-violet-100 text-violet-700 border-violet-300 font-semibold text-[10px] rounded-sm px-1.5 py-0.5"
```

### 4.3 Inputs e Filtros

```tsx
// Input padrão
<Input className="h-8 text-xs shadow-none border-border/50 placeholder:text-muted-foreground" />

// Select padrão
<SelectTrigger className="h-8 text-xs shadow-none border-border/50">

// Button ação (outline)
<Button variant="outline" size="sm" className="h-8 text-xs shadow-none border-border/50">

// Label obrigatória
<label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
  Nome do Campo
</label>
```

### 4.4 Header de Página (PageHeader)

```tsx
<div className="flex items-center justify-between mb-4">
  <div>
    <h1 className="text-sm font-semibold text-foreground">Nome da Página</h1>
    <p className="text-xs text-muted-foreground mt-0.5">Descrição curta</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Ações da página */}
  </div>
</div>
```

### 4.5 Tabela de Alta Densidade (TanStack Table)

```tsx
// Configuração base — compact mode
<Table>
  <TableHeader>
    <TableRow className="hover:bg-transparent border-border/50">
      <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground py-2 h-8">
        COLUNA
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="hover:bg-muted/30 border-border/30 group">
      <TableCell className="py-1.5 text-xs">
        {value}
      </TableCell>
      {/* Ações em hover — visíveis só no hover da linha */}
      <TableCell className="py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
          <Pencil className="w-3 h-3" />
        </Button>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### 4.6 Seção com Título (padrão para agrupar conteúdo)

```tsx
<div className="mb-4">
  <div className="flex items-center gap-1.5 mb-2">
    <IconName className="w-3 h-3 text-muted-foreground" />
    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      TÍTULO DA SEÇÃO
    </span>
  </div>
  {/* conteúdo */}
</div>
```

---

## 5. Arquitetura de Arquivos

```
src/
├── pages/
│   └── admin/
│       └── distribuidor/
│           ├── DistribuidorLayout.tsx          # Layout wrapper do módulo
│           ├── DistribuidorDashboard.tsx        # Visão geral / home do módulo
│           ├── distribuidores/
│           │   ├── DistribuidoresList.tsx       # Lista de todos os distribuidores
│           │   └── DistribuidorDetail.tsx       # Detalhe de um distribuidor
│           ├── performance/
│           │   ├── PerformanceList.tsx          # Ranking e comparativo
│           │   └── VendedorDetail.tsx           # Detalhe por vendedor
│           ├── excelencia/
│           │   ├── ExcelenciaList.tsx           # Clientes no Plano de Excelência
│           │   └── ClienteExcelenciaDetail.tsx  # Detalhe do cliente estratégico
│           ├── metas/
│           │   └── MetasPanel.tsx              # Gestão de metas por hierarquia
│           └── estoque/
│               └── EstoquePanel.tsx            # Nível de estoque + sugestões
│
│           ├── visitas/
│           │   ├── VisitasList.tsx              # Histórico de visitas do cliente
│           │   ├── VisitaForm.tsx               # Formulário de auditoria de campo
│           │   └── VisitaDetail.tsx             # Detalhe/relatório de uma visita
│
├── components/
│   └── distribuidor/
│       ├── KPIGrid.tsx                         # Grid de KPIs do distribuidor
│       ├── PerformanceTable.tsx                # Tabela de performance por vendedor
│       ├── ClienteExcelenciaCard.tsx           # Card de cliente do plano de excelência
│       ├── MetaProgressBar.tsx                 # Barra de progresso de meta
│       ├── EstoqueAlertCard.tsx                # Card de alerta de ruptura
│       ├── DistribuidorStatusBadge.tsx         # Badge de status reutilizável
│       ├── IngestaoUpload.tsx                  # Componente de upload de relatório
│       ├── VisitaScoreBadge.tsx                # Badge de score de execução (0-100)
│       ├── VisitaChecklistItem.tsx             # Item individual do checklist de auditoria
│       └── VisitaFotoGallery.tsx               # Galeria de fotos da visita
│
├── hooks/
│   └── distribuidor/
│       ├── useDistribuidores.ts                # Fetch lista de distribuidores
│       ├── useDistribuidorPerformance.ts       # Dados de performance/sell-out
│       ├── useClientesExcelencia.ts            # Clientes do plano de excelência
│       ├── useMetas.ts                         # Metas e progresso
│       ├── useEstoque.ts                       # Dados de estoque
│       └── useVisitasCampo.ts                  # CRUD de visitas de auditoria
│
└── types/
    └── distribuidor.ts                         # Tipos TypeScript do módulo
```

---

## 6. Tipos TypeScript

```typescript
// src/types/distribuidor.ts

export interface Distribuidor {
  id: string
  nome: string
  cnpj: string
  estado: 'PE' | 'PB' | 'RN' | 'AL' | 'SE'
  cidade: string
  responsavel: string
  email?: string
  telefone?: string
  status: 'ativo' | 'inativo' | 'em_analise'
  criado_em: string
  atualizado_em: string
}

export interface Vendedor {
  id: string
  distribuidor_id: string
  nome: string
  supervisor_id?: string
  tipo: 'vendedor' | 'supervisor' | 'gerente'
}

export interface PerformancePeriodo {
  id: string
  distribuidor_id: string
  vendedor_id: string
  periodo_inicio: string  // ISO date
  periodo_fim: string     // ISO date
  faturamento: number
  clientes_positivados: number
  total_clientes_carteira: number
  itens_vendidos: number
  pedidos_realizados: number
  criado_em: string
}

export interface ClienteDistribuidor {
  id: string
  distribuidor_id: string
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  cidade: string
  estado: string
  vendedor_id?: string
  plano_excelencia: boolean
  itens_cadastrados: number
  ultima_compra?: string
  frequencia_compra_dias?: number
  ticket_medio?: number
  status: 'ativo' | 'inativo' | 'em_risco'
}

export interface ExcelenciaCriterio {
  id: string
  cliente_id: string
  criterio: 'mix_minimo' | 'recorrencia' | 'volume_minimo' | 'itens_cadastrados'
  meta: number
  realizado: number
  atingido: boolean
  periodo: string
}

export interface Meta {
  id: string
  distribuidor_id: string
  vendedor_id?: string         // null = meta do distribuidor inteiro
  hierarquia: 'vendedor' | 'supervisor' | 'gerente' | 'distribuidor'
  tipo: 'faturamento' | 'positivacao' | 'mix' | 'clientes_excelencia'
  periodo_inicio: string
  periodo_fim: string
  valor_meta: number
  valor_realizado: number
  percentual_atingimento: number
}

export interface EstoqueItem {
  id: string
  distribuidor_id: string
  sku: string
  descricao: string
  quantidade_atual: number
  quantidade_minima: number   // ponto de reorder
  dias_cobertura: number      // baseado na média de venda
  status: 'normal' | 'baixo' | 'critico' | 'ruptura'
  ultima_atualizacao: string
  sugestao_pedido?: number
}

export interface RelatorioIngestao {
  id: string
  distribuidor_id: string
  tipo: 'vendas' | 'estoque' | 'clientes'
  arquivo_nome: string
  status: 'pendente' | 'processando' | 'concluido' | 'erro'
  periodo_referencia: string
  registros_processados?: number
  erros?: string[]
  criado_em: string
}

// Visita de campo / Auditoria de PDV
export interface VisitaCampo {
  id: string
  cliente_id: string           // cliente do plano de excelência
  distribuidor_id: string
  visitante_tipo: 'representante_arruda' | 'promotor_distribuidor'
  visitante_nome: string
  data_visita: string          // ISO date
  status: 'rascunho' | 'concluida' | 'compartilhada'

  // Checklist de auditoria
  gondola_posicionamento: 'ok' | 'nok' | 'na'
  gondola_share_espaco: 'ok' | 'nok' | 'na'
  gondola_obs?: string

  estoque_nivel: 'adequado' | 'baixo' | 'ruptura' | 'na'
  estoque_obs?: string

  precificacao_status: 'correto' | 'incorreto' | 'ausente' | 'na'
  precificacao_preco_encontrado?: number
  precificacao_preco_sugerido?: number
  precificacao_obs?: string

  pdv_wobbler: boolean
  pdv_display: boolean
  pdv_banner: boolean
  pdv_outros?: string
  pdv_obs?: string

  problema_ruptura: boolean
  problema_vencimento: boolean
  problema_avaria: boolean
  problema_obs?: string

  // Score calculado (0-100)
  score_execucao: number

  // Fotos (array de URLs no Supabase Storage)
  fotos: string[]

  // Visibilidade
  compartilhado_distribuidor: boolean
  compartilhado_em?: string

  criado_em: string
  atualizado_em: string
}

export interface VisitaChecklist {
  criterio: string
  status: 'ok' | 'nok' | 'na'
  obs?: string
  foto_url?: string
}

// KPIs agregados para o dashboard
export interface DistribuidorKPIs {
  faturamento_periodo: number
  faturamento_periodo_anterior: number
  variacao_percentual: number
  clientes_positivados: number
  total_clientes_carteira: number
  taxa_positivacao: number
  clientes_excelencia_ativos: number
  clientes_excelencia_total: number
  metas_atingidas: number
  total_metas: number
  itens_estoque_critico: number
}
```

---

## 7. Schema Supabase

```sql
-- Distribuidores parceiros
CREATE TABLE distribuidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('PE','PB','RN','AL','SE')),
  cidade TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','em_analise')),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Hierarquia comercial do distribuidor
CREATE TABLE vendedores_distribuidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  supervisor_id UUID REFERENCES vendedores_distribuidor(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('vendedor','supervisor','gerente')),
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Dados de performance por período (sell-out)
CREATE TABLE performance_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES vendedores_distribuidor(id),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  faturamento DECIMAL(15,2) DEFAULT 0,
  clientes_positivados INTEGER DEFAULT 0,
  total_clientes_carteira INTEGER DEFAULT 0,
  itens_vendidos INTEGER DEFAULT 0,
  pedidos_realizados INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(distribuidor_id, vendedor_id, periodo_inicio, periodo_fim)
);

-- Base de clientes do distribuidor
CREATE TABLE clientes_distribuidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  vendedor_id UUID REFERENCES vendedores_distribuidor(id),
  plano_excelencia BOOLEAN DEFAULT FALSE,
  itens_cadastrados INTEGER DEFAULT 0,
  ultima_compra DATE,
  frequencia_compra_dias INTEGER,
  ticket_medio DECIMAL(10,2),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','em_risco')),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(distribuidor_id, cnpj)
);

-- Critérios de excelência por cliente
CREATE TABLE excelencia_criterios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes_distribuidor(id) ON DELETE CASCADE,
  criterio TEXT NOT NULL CHECK (criterio IN ('mix_minimo','recorrencia','volume_minimo','itens_cadastrados')),
  meta DECIMAL(10,2) NOT NULL,
  realizado DECIMAL(10,2) DEFAULT 0,
  atingido BOOLEAN DEFAULT FALSE,
  periodo DATE NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Metas por hierarquia
CREATE TABLE metas_distribuidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES vendedores_distribuidor(id), -- NULL = meta do distribuidor
  hierarquia TEXT NOT NULL CHECK (hierarquia IN ('vendedor','supervisor','gerente','distribuidor')),
  tipo TEXT NOT NULL CHECK (tipo IN ('faturamento','positivacao','mix','clientes_excelencia')),
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  valor_meta DECIMAL(15,2) NOT NULL,
  valor_realizado DECIMAL(15,2) DEFAULT 0,
  percentual_atingimento DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN valor_meta > 0 THEN (valor_realizado / valor_meta * 100) ELSE 0 END
  ) STORED,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Estoque por distribuidor
CREATE TABLE estoque_distribuidor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  descricao TEXT NOT NULL,
  quantidade_atual DECIMAL(10,3) DEFAULT 0,
  quantidade_minima DECIMAL(10,3) DEFAULT 0,
  dias_cobertura DECIMAL(5,1) DEFAULT 0,
  status TEXT DEFAULT 'normal' CHECK (status IN ('normal','baixo','critico','ruptura')),
  sugestao_pedido DECIMAL(10,3),
  ultima_atualizacao TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(distribuidor_id, sku)
);

-- Visitas de campo / Auditorias de PDV
CREATE TABLE distribuidor_visitas_campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes_distribuidor(id) ON DELETE CASCADE,
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  visitante_tipo TEXT NOT NULL CHECK (visitante_tipo IN ('representante_arruda','promotor_distribuidor')),
  visitante_nome TEXT NOT NULL,
  data_visita DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','concluida','compartilhada')),

  -- Execução de gôndola
  gondola_posicionamento TEXT CHECK (gondola_posicionamento IN ('ok','nok','na')),
  gondola_share_espaco TEXT CHECK (gondola_share_espaco IN ('ok','nok','na')),
  gondola_obs TEXT,

  -- Estoque visível na loja
  estoque_nivel TEXT CHECK (estoque_nivel IN ('adequado','baixo','ruptura','na')),
  estoque_obs TEXT,

  -- Precificação
  precificacao_status TEXT CHECK (precificacao_status IN ('correto','incorreto','ausente','na')),
  precificacao_preco_encontrado DECIMAL(10,2),
  precificacao_preco_sugerido DECIMAL(10,2),
  precificacao_obs TEXT,

  -- Materiais de PDV
  pdv_wobbler BOOLEAN DEFAULT FALSE,
  pdv_display BOOLEAN DEFAULT FALSE,
  pdv_banner BOOLEAN DEFAULT FALSE,
  pdv_outros TEXT,
  pdv_obs TEXT,

  -- Problemas operacionais
  problema_ruptura BOOLEAN DEFAULT FALSE,
  problema_vencimento BOOLEAN DEFAULT FALSE,
  problema_avaria BOOLEAN DEFAULT FALSE,
  problema_obs TEXT,

  -- Score de execução calculado (0-100)
  score_execucao INTEGER DEFAULT 0,

  -- Fotos (array de paths no Supabase Storage)
  fotos TEXT[] DEFAULT '{}',

  -- Compartilhamento
  compartilhado_distribuidor BOOLEAN DEFAULT FALSE,
  compartilhado_em TIMESTAMPTZ,

  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_visitas_cliente ON distribuidor_visitas_campo(cliente_id, data_visita DESC);
CREATE INDEX idx_visitas_distribuidor ON distribuidor_visitas_campo(distribuidor_id, data_visita DESC);
CREATE INDEX idx_visitas_status ON distribuidor_visitas_campo(status);

-- Histórico de ingestão de relatórios
CREATE TABLE relatorios_ingestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distribuidor_id UUID REFERENCES distribuidores(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vendas','estoque','clientes')),
  arquivo_nome TEXT NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','processando','concluido','erro')),
  periodo_referencia DATE NOT NULL,
  registros_processados INTEGER,
  erros JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de performance
CREATE INDEX idx_performance_distribuidor ON performance_periodo(distribuidor_id, periodo_inicio DESC);
CREATE INDEX idx_clientes_distribuidor ON clientes_distribuidor(distribuidor_id, plano_excelencia);
CREATE INDEX idx_metas_distribuidor ON metas_distribuidor(distribuidor_id, periodo_inicio DESC);
CREATE INDEX idx_estoque_status ON estoque_distribuidor(distribuidor_id, status);
```

---

## 8. Telas e seus KPIs

### 8.1 Dashboard Distribuidor+ (rota: `/admin/distribuidor`)

**KPI Cards — linha 1 (visão geral de todos os distribuidores):**
- Faturamento Total Período (com variação %)
- Distribuidores Ativos
- Clientes Positivados / Total Carteira (taxa %)
- Clientes Plano Excelência (ativos / total)

**KPI Cards — linha 2 (alertas):**
- Metas Atingidas / Total
- Itens em Ruptura
- Distribuidores Sem Dados Recentes (> 7 dias)
- Relatórios Pendentes de Processamento

**Seções:**
- Ranking de distribuidores por faturamento (tabela compacta, top 10)
- Alertas de estoque crítico (cards compactos)
- Últimos relatórios recebidos (lista simples)

### 8.2 Detalhe do Distribuidor (rota: `/admin/distribuidor/:id`)

**KPI Cards:**
- Faturamento do Período
- Clientes Positivados / Carteira
- Taxa de Positivação
- Clientes Excelência Ativos
- Meta Geral (% atingimento)
- Itens em Ruptura

**Abas (Tabs):**
1. **Performance** — tabela por vendedor (faturamento, positivados, itens vendidos, meta %)
2. **Clientes** — tabela de todos os clientes com filtro por excelência, status, vendedor
3. **Metas** — painel de metas com barra de progresso por hierarquia
4. **Estoque** — tabela de itens com status de cobertura e sugestão de pedido
5. **Histórico** — log de relatórios recebidos e processados

### 8.3 Plano de Excelência (rota: `/admin/distribuidor/excelencia`)

**KPI Cards:**
- Total de Clientes no Plano
- Clientes com 100% dos Critérios
- Critérios Mais Descumpridos
- Distribuidores com Maior Adesão

**Tabela principal:**
- Cliente (CNPJ + nome fantasia), Distribuidor, Vendedor, Critérios (badges por critério), Status Geral, Última Compra, Ações

### 8.4 Gestão de Metas (rota: `/admin/distribuidor/metas`)

**Filtros:** Período, Distribuidor, Hierarquia, Tipo de Meta

**Visualizações:**
- Cards de progresso por distribuidor (% atingimento com cor semântica)
- Tabela detalhada por vendedor/supervisor

### 8.5 Visita de Campo — Formulário de Auditoria (rota: `/admin/distribuidor/visitas/nova`)

Formulário mobile-friendly (usado em campo, potencialmente no celular). Organizado em seções via abas ou scroll contínuo com sticky nav lateral.

**Seções do formulário:**

**1. Identificação**
- Cliente (select com busca por nome/CNPJ)
- Distribuidor (preenchido automaticamente pelo cliente)
- Data da visita
- Quem está visitando (representante Arruda ou promotor do distribuidor + nome)

**2. Execução de Gôndola**
- Posicionamento dos produtos: OK / NOK / N/A
- Share de espaço adequado: OK / NOK / N/A
- Observações + botão de foto

**3. Estoque Visível**
- Nível de estoque: Adequado / Baixo / Ruptura / N/A
- Observações + botão de foto

**4. Precificação**
- Status: Correto / Incorreto / Ausente / N/A
- Se incorreto: campo para preço encontrado e preço sugerido
- Observações + botão de foto

**5. Materiais de PDV**
- Checkboxes: Wobbler / Display / Banner / Outros
- Observações + botão de foto

**6. Problemas Operacionais**
- Checkboxes: Ruptura / Produto vencendo / Avaria / Outros
- Observações + botão de foto

**7. Fotos Gerais**
- Upload múltiplo de fotos livres (evidências adicionais)

**Ações:**
- Salvar como rascunho
- Concluir visita (calcula score automaticamente)
- Concluir e compartilhar com distribuidor (muda status para `compartilhada` + registra timestamp)

### 8.6 Histórico de Visitas do Cliente (dentro do ClienteExcelenciaDetail)

Nova aba **Visitas** dentro do detalhe do cliente:
- Lista cronológica de visitas com data, visitante, score de execução e status
- Expandir linha → ver resumo do checklist
- Botão de ver relatório completo
- Score médio das últimas N visitas (KPI no topo)

### 8.7 Score de Execução — Lógica de Cálculo

```
Cada critério auditado vale pontos quando status = 'ok':
  gondola_posicionamento  → 20 pts
  gondola_share_espaco    → 10 pts
  estoque_nivel adequado  → 20 pts
  precificacao_status     → 20 pts
  pdv (wobbler+display)   → 15 pts (7.5 cada)
  sem_problemas_criticos  → 15 pts (ruptura ou vencimento = 0)

Critérios marcados como 'na' são excluídos do denominador.
Score final = (pontos_obtidos / pontos_possíveis) * 100, arredondado para inteiro.

Cor semântica do score:
  verde   → score >= 80
  amarelo → score >= 60 e < 80
  vermelho → score < 60
```

### Cálculo de Status de Estoque
```
dias_cobertura = quantidade_atual / media_venda_diaria_30d

status:
  ruptura  → dias_cobertura <= 0
  critico  → dias_cobertura <= 3
  baixo    → dias_cobertura <= 7
  normal   → dias_cobertura > 7

sugestao_pedido = MAX(0, (meta_dias_cobertura * media_venda_diaria) - quantidade_atual)
  onde meta_dias_cobertura = 30 (configurável)
```

### Cálculo de Status de Cliente (Excelência)
```
Um cliente está "ativo" no plano quando:
  - Todos os critérios definidos estão atingidos NO PERÍODO CORRENTE

Status do cliente:
  ativo    → todos critérios atingidos
  em_risco → 1+ critérios não atingidos mas com realizado > 70% da meta
  inativo  → 1+ critérios com realizado <= 70% da meta
```

### Cálculo de Taxa de Positivação
```
taxa_positivacao = (clientes_positivados / total_clientes_carteira) * 100
```

### Cálculo de Atingimento de Meta
```
percentual = (valor_realizado / valor_meta) * 100

cor semântica:
  verde   → percentual >= 100
  amarelo → percentual >= 70 e < 100
  vermelho → percentual < 70
```

---

## 10. Ingestão de Relatórios (MVP)

No MVP, o fluxo de ingestão é via **upload de arquivo padronizado**. O distribuidor envia um arquivo Excel/CSV seguindo o template Campestre, e o sistema processa e popula as tabelas.

### Layout do Relatório de Vendas (template)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_venda` | DATE (dd/mm/aaaa) | ✅ | Data da venda / emissão |
| `numero_nf` | TEXT | ✅ | Número da nota (repetido em cada linha de item da mesma NF) |
| `cnpj_cliente` | TEXT (14 dígitos) | ✅ | CNPJ sem formatação |
| `nome_cliente` | TEXT | ✅ | Nome fantasia ou razão social |
| `codigo_vendedor` | TEXT | ✅ | Código interno do vendedor no distribuidor |
| `nome_vendedor` | TEXT | ✅ | Nome do vendedor |
| `codigo_supervisor` | TEXT | ❌ | Código do supervisor |
| `nome_supervisor` | TEXT | ❌ | Nome do supervisor |
| `codigo_gerente` | TEXT | ❌ | Código do gerente |
| `nome_gerente` | TEXT | ❌ | Nome do gerente |
| `sku` | TEXT | ✅ | Código do produto Campestre |
| `descricao_produto` | TEXT | ✅ | Descrição |
| `quantidade` | DECIMAL | ✅ | Quantidade (na unidade de `unidade`) |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. |
| `valor_unitario` | DECIMAL | ✅ | Preço unitário de venda |
| `valor_total` | DECIMAL | ✅ | Valor total da linha (item) |

### Layout do Relatório de Estoque (template)

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_posicao` | DATE | ✅ | Data da posição de estoque |
| `sku` | TEXT | ✅ | Código do produto |
| `descricao` | TEXT | ✅ | Descrição do produto |
| `quantidade_estoque` | DECIMAL | ✅ | Quantidade em estoque |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. |

---

## 11. Supabase Storage — Fotos de Visita

### Bucket
```
Nome: distribuidor-visitas
Acesso: privado (RLS obrigatório)
```

### Estrutura de paths
```
distribuidor-visitas/
  {distribuidor_id}/
    {cliente_id}/
      {visita_id}/
        gondola_01.jpg
        estoque_01.jpg
        pdv_01.jpg
        geral_01.jpg
        ...
```

### Regras de upload
- Extensões permitidas: `.jpg`, `.jpeg`, `.png`, `.webp`
- Tamanho máximo por foto: 5MB
- Máximo de fotos por visita: 20
- Nome do arquivo: gerado no frontend como `{secao}_{timestamp}.{ext}` para evitar colisão
- Upload via `supabase.storage.from('distribuidor-visitas').upload(path, file)`
- URL pública gerada via `supabase.storage.from('distribuidor-visitas').createSignedUrl(path, 3600)` (válida por 1h)

### Componente `VisitaFotoGallery.tsx`
- Suporta upload múltiplo (input `multiple`)
- Preview inline antes de salvar
- Indicador de progresso por foto
- Botão de remover foto (deleta do Storage + remove do array `fotos` da visita)
- Ao exibir galeria, buscar signed URLs em batch (uma chamada por foto)

---

## 12. O que NÃO fazer

- ❌ Não usar `shadow-md`, `shadow-lg` em cards — sempre `shadow-none`
- ❌ Não usar `rounded-full` em badges de status — sempre `rounded-sm`
- ❌ Não usar gradientes (`bg-gradient-to-br`) — cores sólidas ou sutis
- ❌ Não usar `p-6` ou `pt-6` em cards — máximo `p-4`, preferencialmente `p-3`
- ❌ Não usar `gap-6` em grids — máximo `gap-3`
- ❌ Não usar `text-sm` em labels de filtro — usar `text-[10px] uppercase tracking-wider`
- ❌ Não criar tabelas sem o padrão TanStack Table + compact mode
- ❌ Não alterar regras de negócio de outros módulos
- ❌ Não instalar dependências não listadas na seção 2 sem verificar o package.json

---

## 13. Checklist de Implementação

### Fase 1 — Fundação
- [ ] Criar `src/types/distribuidor.ts` com todos os tipos
- [ ] Executar migrations SQL no Supabase
- [ ] Criar hooks base (`useDistribuidores`, `useDistribuidorPerformance`)
- [ ] Criar rota `/admin/distribuidor` no `App.tsx`
- [ ] Criar `DistribuidorLayout.tsx` com sidebar de navegação interna

### Fase 2 — Dashboard e Lista
- [ ] `DistribuidorDashboard.tsx` — KPIs globais + ranking
- [ ] `DistribuidoresList.tsx` — tabela compacta com status
- [ ] `DistribuidorStatusBadge.tsx` — componente reutilizável

### Fase 3 — Detalhe do Distribuidor
- [ ] `DistribuidorDetail.tsx` — estrutura com abas
- [ ] Aba Performance — tabela por vendedor
- [ ] Aba Clientes — tabela com filtros
- [ ] Aba Metas — `MetaProgressBar.tsx`
- [ ] Aba Estoque — `EstoqueAlertCard.tsx`
- [ ] Aba Histórico — log de ingestões

### Fase 4 — Plano de Excelência
- [ ] `ExcelenciaList.tsx` — visão consolidada com KPIs globais
- [ ] `ClienteExcelenciaDetail.tsx` — critérios por cliente + aba Visitas
- [ ] `ClienteExcelenciaCard.tsx` — card reutilizável

### Fase 5 — Field Execution (Auditorias de Campo)
- [ ] Migration SQL — tabela `distribuidor_visitas_campo`
- [ ] `VisitaForm.tsx` — formulário de auditoria completo (mobile-friendly)
- [ ] Lógica de cálculo de score de execução
- [ ] `VisitaDetail.tsx` — relatório de visita formatado para compartilhamento
- [ ] `VisitasList.tsx` — histórico dentro do ClienteExcelenciaDetail
- [ ] `VisitaScoreBadge.tsx` — badge com cor semântica por score
- [ ] `VisitaFotoGallery.tsx` — galeria de fotos com upload para Supabase Storage
- [ ] Fluxo de compartilhamento com distribuidor (mudança de status + timestamp)

### Fase 6 — Ingestão
- [ ] `IngestaoUpload.tsx` — upload de relatório
- [ ] Parser de Excel/CSV no backend (Supabase Edge Function ou n8n)
- [ ] Feedback de processamento em tempo real

---

*Documento gerado em 12/03/2026. Referência de design: `high-density-design-spec.md` (commit f907a58). Para dúvidas de padrão visual, consultar sempre este documento antes de qualquer decisão de estilo.*
