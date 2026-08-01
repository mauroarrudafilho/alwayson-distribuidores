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
}

type DocWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } }

/** Gera PDF tabular (A4) e dispara download no browser. */
export function downloadPdfReport(opts: PdfReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(opts.title, margin, y)
  y += 7

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(90)
    const subLines = doc.splitTextToSize(opts.subtitle, pageW - margin * 2)
    doc.text(subLines, margin, y)
    y += subLines.length * 4 + 2
    doc.setTextColor(0)
  }

  if (opts.meta?.length) {
    doc.setFontSize(9)
    for (const line of opts.meta) {
      if (y > 275) {
        doc.addPage()
        y = 16
      }
      doc.setFont('helvetica', 'bold')
      doc.text(`${line.label}:`, margin, y)
      const labelW = doc.getTextWidth(`${line.label}: `)
      doc.setFont('helvetica', 'normal')
      const valLines = doc.splitTextToSize(line.value, pageW - margin * 2 - labelW)
      doc.text(valLines, margin + labelW, y)
      y += Math.max(valLines.length * 4.2, 4.5)
    }
    y += 3
  }

  for (const section of opts.sections ?? []) {
    if (y > 250) {
      doc.addPage()
      y = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(section.title, margin, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [section.head],
      body: section.body,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
    })

    y = (doc as DocWithAutoTable).lastAutoTable.finalY + 8
  }

  if (opts.footer) {
    const footerY = doc.internal.pageSize.getHeight() - 10
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(130)
    const footerLines = doc.splitTextToSize(opts.footer, pageW - margin * 2)
    doc.text(footerLines, margin, footerY)
  }

  const name = opts.filename.endsWith('.pdf') ? opts.filename : `${opts.filename}.pdf`
  doc.save(name)
}
