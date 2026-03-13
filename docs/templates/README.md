# Templates de Ingestão

Templates XLSX para upload de relatórios no módulo de ingestão.

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `template_relatorio_vendas.xlsx` | Apenas aba de vendas (sell-out) |
| `template_relatorio_estoque.xlsx` | Apenas aba de estoque |
| `template_relatorios_completo.xlsx` | Ambas as abas em um único arquivo |

## Colunas — Relatório de Vendas

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_venda` | DATE (dd/mm/aaaa) | ✅ | Data da venda |
| `cnpj_cliente` | TEXT (14 dígitos) | ✅ | CNPJ sem formatação |
| `nome_cliente` | TEXT | ✅ | Nome fantasia ou razão social |
| `codigo_vendedor` | TEXT | ✅ | Código interno do vendedor |
| `nome_vendedor` | TEXT | ✅ | Nome do vendedor |
| `sku` | TEXT | ✅ | Código do produto Campestre |
| `descricao_produto` | TEXT | ✅ | Descrição do produto |
| `quantidade` | DECIMAL | ✅ | Quantidade vendida |
| `valor_unitario` | DECIMAL | ✅ | Preço unitário |
| `valor_total` | DECIMAL | ✅ | Valor total do item |
| `codigo_supervisor` | TEXT | ❌ | Código do supervisor (opcional) |

## Colunas — Relatório de Estoque

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `data_posicao` | DATE | ✅ | Data da posição de estoque |
| `sku` | TEXT | ✅ | Código do produto |
| `descricao` | TEXT | ✅ | Descrição do produto |
| `quantidade_estoque` | DECIMAL | ✅ | Quantidade em estoque |
| `unidade` | TEXT | ✅ | UN, CX, KG, etc. |

## Regenerar templates

```bash
node scripts/gerar-templates-ingestao.mjs
```
