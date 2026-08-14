import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PdfMetaLine = { label: string; value: string }

export type PdfTableSection = {
  title: string
  head: string[]
  body: (string | number)[][]
}

type PdfReportOptions = {
  filename: string
  title: string
  subtitle?: string
  meta?: PdfMetaLine[]
  sections?: PdfTableSection[]
  footer?: string
  /** Marca no cabeçalho — padrão M.I.R.A. */
  brand?: string
}

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } }

/** Arruda Hub v2 — Navy + Teal (system.md) */
const BRAND = {
  navy: [10, 35, 66] as [number, number, number],
  teal: [20, 184, 166] as [number, number, number],
  foreground: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  footer: [148, 163, 184] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const MARGIN = 14
const HEADER_FULL_H = 34
const HEADER_SLIM_H = 12
const FOOTER_RESERVE = 14

function setRgb(
  doc: jsPDF,
  color: [number, number, number],
  mode: 'text' | 'draw' | 'fill'
) {
  if (mode === 'text') doc.setTextColor(color[0], color[1], color[2])
  else if (mode === 'draw') doc.setDrawColor(color[0], color[1], color[2])
  else doc.setFillColor(color[0], color[1], color[2])
}

function formatGeneratedAt(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())
}

function drawFullHeader(doc: jsPDF, opts: PdfReportOptions) {
  const pageW = doc.internal.pageSize.getWidth()

  setRgb(doc, BRAND.navy, 'fill')
  doc.rect(0, 0, pageW, HEADER_FULL_H, 'F')

  setRgb(doc, BRAND.teal, 'fill')
  doc.rect(0, HEADER_FULL_H, pageW, 0.6, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  setRgb(doc, BRAND.teal, 'text')
  doc.text((opts.brand ?? 'M.I.R.A.').toUpperCase(), MARGIN, 9)

  doc.setFontSize(15)
  setRgb(doc, BRAND.white, 'text')
  doc.text(opts.title, MARGIN, 18)

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setRgb(doc, [203, 213, 225], 'text')
    const subLines = doc.splitTextToSize(opts.subtitle, pageW - MARGIN * 2)
    doc.text(subLines.slice(0, 2), MARGIN, 25)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setRgb(doc, BRAND.footer, 'text')
  doc.text(formatGeneratedAt(), pageW - MARGIN, 9, { align: 'right' })
}

function drawSlimHeader(doc: jsPDF, title: string, brand: string) {
  const pageW = doc.internal.pageSize.getWidth()

  setRgb(doc, BRAND.navy, 'fill')
  doc.rect(0, 0, pageW, HEADER_SLIM_H, 'F')

  setRgb(doc, BRAND.teal, 'fill')
  doc.rect(0, HEADER_SLIM_H, pageW, 0.4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setRgb(doc, BRAND.teal, 'text')
  doc.text(brand.toUpperCase(), MARGIN, 7.5)

  doc.setFontSize(9)
  setRgb(doc, BRAND.white, 'text')
  const truncated =
    title.length > 72 ? `${title.slice(0, 69)}…` : title
  doc.text(truncated, MARGIN + 28, 7.5)
}

function measureMetaCellHeight(
  doc: jsPDF,
  value: string,
  colW: number
): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const lines = doc.splitTextToSize(value, colW - 5)
  return Math.max(11, 5 + lines.length * 3.6)
}

function drawMetaGrid(doc: jsPDF, meta: PdfMetaLine[], startY: number): number {
  const pageW = doc.internal.pageSize.getWidth()
  const innerW = pageW - MARGIN * 2
  const gap = 4
  const colW = (innerW - gap) / 2
  let y = startY

  for (let i = 0; i < meta.length; i += 2) {
    const left = meta[i]
    const right = meta[i + 1]
    const leftH = measureMetaCellHeight(doc, left.value, colW)
    const rightH = right
      ? measureMetaCellHeight(doc, right.value, colW)
      : 0
    const rowH = Math.max(leftH, rightH)

    const drawCell = (x: number, item: PdfMetaLine) => {
      setRgb(doc, BRAND.surface, 'fill')
      setRgb(doc, BRAND.border, 'draw')
      doc.setLineWidth(0.2)
      doc.roundedRect(x, y, colW, rowH, 1.5, 1.5, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      setRgb(doc, BRAND.muted, 'text')
      doc.text(item.label.toUpperCase(), x + 2.5, y + 4)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setRgb(doc, BRAND.foreground, 'text')
      const valLines = doc.splitTextToSize(item.value, colW - 5)
      doc.text(valLines, x + 2.5, y + 8)
    }

    drawCell(MARGIN, left)
    if (right) drawCell(MARGIN + colW + gap, right)

    y += rowH + gap
  }

  return y + 2
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setRgb(doc, BRAND.muted, 'text')
  doc.text(title.toUpperCase(), MARGIN, y)

  setRgb(doc, BRAND.teal, 'draw')
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.2, MARGIN + 14, y + 1.2)

  return y + 6
}

function columnStylesForHead(head: string[]): Record<number, object> {
  const styles: Record<number, object> = {}
  const numericHint =
    /^(R\$|Valor|Faturamento|Qtd|Quantidade|Hist|Atual|Un|Ticket|NFs)/i

  head.forEach((label, idx) => {
    if (numericHint.test(label.trim())) {
      styles[idx] = { halign: 'right' as const, cellWidth: 'wrap' }
    }
    if (/^SKU$/i.test(label.trim())) {
      styles[idx] = { cellWidth: 22, font: 'courier', fontSize: 7 }
    }
    if (/^Descrição|^Produto/i.test(label.trim())) {
      styles[idx] = { cellWidth: 'auto' }
    }
  })

  return styles
}

function paintFooters(doc: jsPDF, footerText?: string) {
  const pageCount = doc.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const generated = formatGeneratedAt()

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)

    setRgb(doc, BRAND.border, 'draw')
    doc.setLineWidth(0.2)
    doc.line(MARGIN, pageH - FOOTER_RESERVE, pageW - MARGIN, pageH - FOOTER_RESERVE)

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    setRgb(doc, BRAND.footer, 'text')

    if (footerText) {
      const lines = doc.splitTextToSize(footerText, pageW - MARGIN * 2 - 28)
      doc.text(lines.slice(0, 2), MARGIN, pageH - 9)
    }

    doc.setFont('helvetica', 'normal')
    doc.text(`Página ${page} de ${pageCount}`, pageW - MARGIN, pageH - 9, {
      align: 'right',
    })
    doc.text(generated, pageW - MARGIN, pageH - 5.5, { align: 'right' })
  }
}

/** Gera PDF tabular (A4) com identidade Arruda Hub e dispara download no browser. */
export function downloadPdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageH = doc.internal.pageSize.getHeight()
  const brand = opts.brand ?? 'M.I.R.A.'
  const contentBottom = pageH - FOOTER_RESERVE - 2

  drawFullHeader(doc, opts)
  let y = HEADER_FULL_H + 8

  if (opts.meta?.length) {
    y = drawMetaGrid(doc, opts.meta, y)
    y += 2
  }

  const tableMargin = {
    left: MARGIN,
    right: MARGIN,
    top: HEADER_SLIM_H + 6,
    bottom: FOOTER_RESERVE + 2,
  }

  for (const section of opts.sections ?? []) {
    if (y > contentBottom - 24) {
      doc.addPage()
      drawSlimHeader(doc, opts.title, brand)
      y = HEADER_SLIM_H + 8
    }

    y = drawSectionTitle(doc, section.title, y)

    autoTable(doc, {
      startY: y,
      head: [section.head],
      body:
        section.body.length > 0
          ? section.body
          : [section.head.map((_, idx) => (idx === 0 ? 'Sem dados no período' : '—'))],
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
        overflow: 'linebreak',
        lineColor: BRAND.border,
        lineWidth: 0.1,
        textColor: BRAND.foreground,
        valign: 'middle',
      },
      headStyles: {
        fillColor: BRAND.navy,
        textColor: BRAND.white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      },
      alternateRowStyles: { fillColor: BRAND.surface },
      columnStyles: columnStylesForHead(section.head),
      margin: tableMargin,
      showHead: 'everyPage',
      tableWidth: 'auto',
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          drawSlimHeader(doc, opts.title, brand)
        }
      },
    })

    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 10
  }

  paintFooters(doc, opts.footer)

  const name = opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`
  doc.save(name)
}
