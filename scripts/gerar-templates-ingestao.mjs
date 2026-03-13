#!/usr/bin/env node
/**
 * Gera templates XLSX para ingestão de relatórios (vendas e estoque).
 * Execute: node scripts/gerar-templates-ingestao.mjs
 */

import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputDir = join(__dirname, '..', 'docs', 'templates')

// Colunas do Relatório de Vendas (template Campestre)
const COLUNAS_VENDAS = [
  'data_venda',        // DATE dd/mm/aaaa
  'cnpj_cliente',      // TEXT 14 dígitos
  'nome_cliente',      // TEXT
  'codigo_vendedor',   // TEXT
  'nome_vendedor',     // TEXT
  'sku',               // TEXT
  'descricao_produto', // TEXT
  'quantidade',        // DECIMAL
  'valor_unitario',    // DECIMAL
  'valor_total',       // DECIMAL
  'codigo_supervisor', // TEXT (opcional)
]

// Colunas do Relatório de Estoque
const COLUNAS_ESTOQUE = [
  'data_posicao',       // DATE
  'sku',                // TEXT
  'descricao',          // TEXT
  'quantidade_estoque',  // DECIMAL
  'unidade',            // TEXT (UN, CX, KG, etc.)
]

// Linhas de exemplo para validação
const EXEMPLO_VENDAS = [
  ['12/03/2026', '12345678000199', 'Mercado Exemplo', 'V001', 'João Silva', 'CAMP-001', 'Produto Campestre 1kg', 10, 25.90, 259.00, 'S001'],
  ['12/03/2026', '98765432000188', 'Supermercado Teste', 'V001', 'João Silva', 'CAMP-002', 'Produto Campestre 500g', 5, 14.50, 72.50, 'S001'],
]

const EXEMPLO_ESTOQUE = [
  ['12/03/2026', 'CAMP-001', 'Produto Campestre 1kg', 150, 'UN'],
  ['12/03/2026', 'CAMP-002', 'Produto Campestre 500g', 80, 'UN'],
]

mkdirSync(outputDir, { recursive: true })

// Template Vendas
const wsVendas = XLSX.utils.aoa_to_sheet([COLUNAS_VENDAS, ...EXEMPLO_VENDAS])
wsVendas['!cols'] = COLUNAS_VENDAS.map(() => ({ wch: 18 }))

const wbVendas = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbVendas, wsVendas, 'Vendas')
XLSX.writeFile(wbVendas, join(outputDir, 'template_relatorio_vendas.xlsx'))
console.log('✓ Gerado: docs/templates/template_relatorio_vendas.xlsx')

// Template Estoque
const wsEstoque = XLSX.utils.aoa_to_sheet([COLUNAS_ESTOQUE, ...EXEMPLO_ESTOQUE])
wsEstoque['!cols'] = COLUNAS_ESTOQUE.map(() => ({ wch: 18 }))

const wbEstoque = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wbEstoque, wsEstoque, 'Estoque')
XLSX.writeFile(wbEstoque, join(outputDir, 'template_relatorio_estoque.xlsx'))
console.log('✓ Gerado: docs/templates/template_relatorio_estoque.xlsx')

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

console.log('\nColunas Vendas:', COLUNAS_VENDAS.join(', '))
console.log('Colunas Estoque:', COLUNAS_ESTOQUE.join(', '))
