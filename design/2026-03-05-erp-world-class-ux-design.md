# Design Document: ERP World Class UX/UI Revamp (V2)

## 1. Visão Geral
Este documento descreve a arquitetura e o design para a refatoração da interface de usuário (UX/UI) do sistema `arruda-hub-commercial-core`, visando alinhá-lo com os padrões de usabilidade de ERPs "World Class" (como SAP, NetSuite, Odoo). O foco principal é aumentar a densidade de informação, produtividade do "Power User" e velocidade de navegação, mantendo a identidade visual atual (Shadcn UI + Tailwind) e garantindo **zero impacto nas regras de negócio existentes**.

## 2. Estratégia de Implementação
Adotaremos a estratégia de **"Componentes V2 e Rotas Paralelas"**.
- Novas rotas serão criadas sob o prefixo `/admin/v2/*`.
- Novos componentes base (ex: `DataTableV2`, `FormLayoutV2`, `AppLayoutV2`) serão desenvolvidos.
- Isso permite testes A/B seguros em produção/homologação sem quebrar o sistema legado.
- O desenvolvimento inicial ocorrerá em um ambiente isolado (Git Worktree).

## 3. Frentes de Atuação

### 3.1. Data Grid V2 (Tabelas e Listagens)
**Objetivo:** Substituir tabelas HTML padrão por grids de alta performance e densidade.
- **Tecnologia:** `TanStack Table` (já presente no projeto).
- **Recursos Chave:**
  - *Compact Mode:* Redução de padding e font-size para exibir mais linhas (ex: 30+ linhas visíveis).
  - *Sticky Elements:* Cabeçalho e primeira coluna fixos durante o scroll.
  - *Filtros Inline:* Inputs de filtro diretamente no cabeçalho de cada coluna (Excel-like).
  - *Ações em Hover:* Botões de ação (Editar, PDF) visíveis apenas ao passar o mouse sobre a linha.
  - *Stateful URLs:* Paginação, ordenação e filtros sincronizados com a URL (ex: `?page=2&status=pendente`).

### 3.2. Power User Forms (Formulários e Atalhos)
**Objetivo:** Otimizar a entrada de dados e prevenir perda de informações.
- **Recursos Chave:**
  - *Keyboard First:* Navegação fluida via `Tab` e atalhos globais (`Ctrl+S` para salvar, `Esc` para cancelar).
  - *Layout Seccionado:* Substituição de formulários longos por navegação lateral (Sticky Sections/Tabs) para acesso rápido a blocos de dados (ex: Dados Gerais, Itens, Logística).
  - *Optimistic UI:* Atualização imediata da interface ao salvar, utilizando `useMutation` do React Query, com rollback em caso de erro.
  - *Dirty State Warning:* Alerta nativo do navegador ao tentar sair da página com alterações não salvas.
  - *Inline Editing:* Edição de itens de pedido diretamente na célula da tabela, sem modais adicionais.

### 3.3. Shell & Navegação (Layout Global)
**Objetivo:** Maximizar o espaço de trabalho e acelerar o acesso a módulos.
- **Recursos Chave:**
  - *Command Palette:* Busca global acionada por `Cmd+K` / `Ctrl+K` para navegação rápida entre telas e ações (ex: "Ir para pedidos", "Buscar cliente").
  - *Sidebar Inteligente:* Menu lateral colapsável (apenas ícones) para ganho de espaço horizontal, com agrupamento lógico de módulos.
  - *Breadcrumbs:* Navegação hierárquica clara e clicável no topo de cada página.
  - *Header Compacto:* Redução da altura do cabeçalho superior, mantendo apenas ações essenciais.

## 4. Escopo da Prova de Conceito (PoC)
Para validar estas premissas, a PoC focará no módulo de **Pedidos**:
1. **Layout Global:** Implementar `AppLayoutV2` com Command Palette e Sidebar colapsável.
2. **Listagem:** Implementar `/admin/v2/orders` usando `DataTableV2`.
3. **Detalhes/Edição:** Implementar `/admin/v2/orders/:id` usando `FormLayoutV2` e atalhos de teclado.

## 5. Critérios de Sucesso
- A rota `/admin/v2/orders` exibe os mesmos dados da rota original, porém com maior densidade e filtros inline funcionais.
- A tela de detalhes do pedido na V2 permite edição rápida via teclado e salva o histórico corretamente (conforme `FLUXO-PEDIDOS-COMPLETO.md`).
- O Command Palette permite navegação sem uso do mouse.
- Nenhuma funcionalidade da V1 foi alterada ou quebrada.