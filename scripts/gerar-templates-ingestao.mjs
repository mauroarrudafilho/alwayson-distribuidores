#!/usr/bin/env node
/**
 * Gera templates XLSX para ingestão de relatórios (vendas, estoque, clientes).
 * Grava em docs/templates (nomes legados) e public/templates (URLs do app: /templates/...).
 * Execute: node scripts/gerar-templates-ingestao.mjs
 */

import * as XLSX from 'xlsx'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = join(__dirname, '..', 'docs', 'templates')
const publicTemplatesDir = join(__dirname, '..', 'public', 'templates')

// Colunas do Relatório de Vendas (template Campestre)
// Alinhado a alwayson_faturamento (numero_nf, data_emissao↔data_venda) + itens;
// hierarquia para resolver vendedor/supervisor/gerente em alwayson_vendedores_distribuidor.
const COLUNAS_VENDAS = [
  'data_venda',          // DATE dd/mm/aaaa — vira data_emissao do faturamento
  'numero_nf',           // TEXT — número da NF (chave lógica com distribuidor; mesma NF em várias linhas = itens)
  'cnpj_cliente',        // TEXT 14 dígitos
  'razao_social',       // TEXT — obrigatório no modelo; arquivos legados sem coluna podem repetir valor em nome_cliente (backend)
  'nome_cliente',        // TEXT — nome fantasia (exibição); planilhas sem razão podem repetir o texto neste campo até o backend enriquecer
  'codigo_vendedor',     // TEXT
  'nome_vendedor',       // TEXT
  'codigo_supervisor',   // TEXT (opcional)
  'nome_supervisor',     // TEXT (opcional)
  'codigo_gerente',      // TEXT (opcional)
  'nome_gerente',        // TEXT (opcional)
  'sku',                 // TEXT
  'descricao_produto',   // TEXT
  'quantidade',          // DECIMAL (na unidade informada: UN, CX, etc.)
  'unidade',             // TEXT — UN, CX, KG, etc. (alinhado a coluna em alwayson_faturamento_itens)
  'valor_unitario',      // DECIMAL
  'valor_total',         // DECIMAL
]

// Colunas do Relatório de Estoque
const COLUNAS_ESTOQUE = [
  'data_posicao',       // DATE
  'sku',                // TEXT
  'descricao',          // TEXT
  'quantidade_estoque',  // DECIMAL
  'unidade',            // TEXT (UN, CX, KG, etc.)
]

// Cadastro / atualização de clientes (tipo: clientes → alwayson_clientes_distribuidor)
const COLUNAS_CLIENTES = [
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'cidade',
  'estado',
  'codigo_vendedor',
  'nome_vendedor',
]

// Linhas de exemplo para validação
const EXEMPLO_VENDAS = [
  [
    '12/03/2026',
    '123456',
    '12345678000199',
    'Mercado Exemplo LTDA',
    'Mercado Exemplo',
    'V001',
    'João Silva',
    'S001',
    'Pedro Costa',
    'G001',
    'Maria Gerência',
    'CAMP-001',
    'Produto Campestre 1kg',
    10,
    'UN',
    25.9,
    259.0,
  ],
  [
    '12/03/2026',
    '123456',
    '12345678000199',
    'Mercado Exemplo LTDA',
    'Mercado Exemplo',
    'V001',
    'João Silva',
    'S001',
    'Pedro Costa',
    'G001',
    'Maria Gerência',
    'CAMP-002',
    'Produto Campestre 500g',
    5,
    'UN',
    14.5,
    72.5,
  ],
  // NF distinta (não combinar CNPJ/cliente diferentes sob o mesmo numero_nf)
  [
    '12/03/2026',
    '123457',
    '98765432000188',
    'Supermercado Teste SA',
    'Supermercado Teste',
    'V001',
    'João Silva',
    'S001',
    'Pedro Costa',
    'G001',
    'Maria Gerência',
    'CAMP-001',
    'Produto Campestre 1kg',
    2,
    'CX',
    25.9,
    51.8,
  ],
]

const EXEMPLO_ESTOQUE = [
  ['12/03/2026', 'CAMP-001', 'Produto Campestre 1kg', 150, 'UN'],
  ['12/03/2026', 'CAMP-002', 'Produto Campestre 500g', 80, 'UN'],
]

const EXEMPLO_CLIENTES = [
  ['12345678000199', 'Mercado Exemplo LTDA', 'Mercado Exemplo', 'João Pessoa', 'PB', 'V001', 'João Silva'],
  ['98765432000188', 'Supermercado Teste SA', 'Super Teste', 'Campina Grande', 'PB', 'V001', 'João Silva'],
]

mkdirSync(outputDir, { recursive: true })
mkdirSync(publicTemplatesDir, { recursive: true })

// Template Vendas
const wsVendas = XLSX.utils.aoa_to_sheet([COLUNAS_VENDAS, ...EXEMPLO_VENDAS])
wsVendas['!cols'] = COLUNAS_VENDAS.map(() => ({ wch: 18 }))

const wbVendas = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbVendas, wsVendas, 'Vendas')
XLSX.writeFile(wbVendas, join(outputDir, 'template_relatorio_vendas.xlsx'))
XLSX.writeFile(wbVendas, join(publicTemplatesDir, 'template-vendas.xlsx'))
console.log('✓ Gerado: docs/templates/template_relatorio_vendas.xlsx')
console.log('✓ Gerado: public/templates/template-vendas.xlsx')

// Template Estoque
const wsEstoque = XLSX.utils.aoa_to_sheet([COLUNAS_ESTOQUE, ...EXEMPLO_ESTOQUE])
wsEstoque['!cols'] = COLUNAS_ESTOQUE.map(() => ({ wch: 18 }))

const wbEstoque = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbEstoque, wsEstoque, 'Estoque')
XLSX.writeFile(wbEstoque, join(outputDir, 'template_relatorio_estoque.xlsx'))
XLSX.writeFile(wbEstoque, join(publicTemplatesDir, 'template-estoque.xlsx'))
console.log('✓ Gerado: docs/templates/template_relatorio_estoque.xlsx')
console.log('✓ Gerado: public/templates/template-estoque.xlsx')

// Template combinado (duas abas)
const wsVendas2 = XLSX.utils.aoa_to_sheet([COLUNAS_VENDAS, ...EXEMPLO_VENDAS])
wsVendas2['!cols'] = COLUNAS_VENDAS.map(() => ({ wch: 18 }))
const wsEstoque2 = XLSX.utils.aoa_to_sheet([COLUNAS_ESTOQUE, ...EXEMPLO_ESTOQUE])
wsEstoque2['!cols'] = COLUNAS_ESTOQUE.map(() => ({ wch: 18 }))

const wbCompleto = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbCompleto, wsVendas2, 'Vendas')
XLSX.utils.book_append_sheet(wbCompleto, wsEstoque2, 'Estoque')
XLSX.writeFile(wbCompleto, join(outputDir, 'template_relatorios_completo.xlsx'))
console.log('✓ Gerado: docs/templates/template_relatorios_completo.xlsx')

// Template Clientes
const wsClientes = XLSX.utils.aoa_to_sheet([COLUNAS_CLIENTES, ...EXEMPLO_CLIENTES])
wsClientes['!cols'] = COLUNAS_CLIENTES.map(() => ({ wch: 20 }))

const wbClientes = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbClientes, wsClientes, 'Clientes')
XLSX.writeFile(wbClientes, join(publicTemplatesDir, 'template-clientes.xlsx'))
console.log('✓ Gerado: public/templates/template-clientes.xlsx')

// Template De-para produtos (código do cliente → SKU oficial)
const COLUNAS_DE_PARA = ['codigo_cliente', 'sku_fornecedor']
const EXEMPLO_DE_PARA = [
  ['CAMP-717', '11.5066'],
  ['CX-992', '11.5084'],
]

const wsDePara = XLSX.utils.aoa_to_sheet([COLUNAS_DE_PARA, ...EXEMPLO_DE_PARA])
wsDePara['!cols'] = [
  { wch: 22 },
  { wch: 14 },
]

const wbDePara = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbDePara, wsDePara, 'De_Para')
XLSX.writeFile(wbDePara, join(publicTemplatesDir, 'template-de-para-produtos.xlsx'))
console.log('✓ Gerado: public/templates/template-de-para-produtos.xlsx')

// De-para Insights (codprod_fornecedor / código origem territorial → SKU fábrica)
const COLUNAS_DE_PARA_INSIGHTS = ['codigo_origem', 'sku_fornecedor']
const EXEMPLO_DE_PARA_INSIGHTS = [
  ['11.7002', '11.5066'],
  ['717', '11.7002'],
]

const wsDeParaInsights = XLSX.utils.aoa_to_sheet([
  COLUNAS_DE_PARA_INSIGHTS,
  ...EXEMPLO_DE_PARA_INSIGHTS,
])
wsDeParaInsights['!cols'] = [{ wch: 22 }, { wch: 14 }]

const wbDeParaInsights = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbDeParaInsights, wsDeParaInsights, 'De_Para')
XLSX.writeFile(
  wbDeParaInsights,
  join(publicTemplatesDir, 'template-de-para-insights-produtos.xlsx')
)
console.log(
  '✓ Gerado: public/templates/template-de-para-insights-produtos.xlsx'
)

console.log('\nColunas Vendas:', COLUNAS_VENDAS.join(', '))
console.log('Colunas Estoque:', COLUNAS_ESTOQUE.join(', '))
console.log('Colunas Clientes:', COLUNAS_CLIENTES.join(', '))
console.log('Colunas De-para produtos:', COLUNAS_DE_PARA.join(', '))
console.log('Colunas De-para Insights:', COLUNAS_DE_PARA_INSIGHTS.join(', '))
