import * as XLSX from 'xlsx'

export function downloadXlsx(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number | null | undefined>[]
) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function downloadXlsxMulti(
  filename: string,
  sheets: { name: string; rows: Record<string, string | number | null | undefined>[] }[]
) {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), sheet.name)
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
