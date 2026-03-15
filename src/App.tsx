import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { Performance } from '@/pages/Performance'
import { Excelencia } from '@/pages/Excelencia'
import { ClientesBusca } from '@/pages/ClientesBusca'
import { ClienteDetalhe } from '@/pages/ClienteDetalhe'
import { EstoquePanel } from '@/pages/EstoquePanel'
import { Admin } from '@/pages/Admin'
import { AdminDistribuidores } from '@/pages/admin/AdminDistribuidores'
import { AdminProdutos } from '@/pages/admin/AdminProdutos'
import { AdminMetas } from '@/pages/admin/AdminMetas'
import { AdminExcelencia } from '@/pages/admin/AdminExcelencia'
import { AdminUsuarios } from '@/pages/admin/AdminUsuarios'
import { IngestaoPanel } from '@/pages/IngestaoPanel'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/excelencia" element={<Excelencia />} />
              <Route path="/clientes" element={<ClientesBusca />} />
              <Route path="/clientes/:id" element={<ClienteDetalhe />} />
              <Route path="/estoque" element={<EstoquePanel />} />
              <Route path="/admin" element={<Admin />}>
                <Route index element={<Navigate to="/admin/distribuidores" replace />} />
                <Route path="distribuidores" element={<AdminDistribuidores />} />
                <Route path="produtos" element={<AdminProdutos />} />
                <Route path="metas" element={<AdminMetas />} />
                <Route path="excelencia" element={<AdminExcelencia />} />
                <Route path="usuarios" element={<AdminUsuarios />} />
              </Route>
              <Route path="/ingestao" element={<IngestaoPanel />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
