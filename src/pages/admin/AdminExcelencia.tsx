import { Award } from 'lucide-react'

export function AdminExcelencia() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Award className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-medium text-foreground">Critérios do plano de excelência</p>
      <p className="text-xs text-muted-foreground mt-1">Em breve</p>
    </div>
  )
}
