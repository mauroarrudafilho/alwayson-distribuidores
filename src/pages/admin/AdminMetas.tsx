import { Target } from 'lucide-react'

export function AdminMetas() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Target className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <p className="text-sm font-medium text-foreground">Configuração de metas por hierarquia</p>
      <p className="text-xs text-muted-foreground mt-1">Em breve</p>
    </div>
  )
}
