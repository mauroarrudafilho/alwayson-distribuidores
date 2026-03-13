import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/pages/Dashboard'
import { DistribuidoresList } from '@/pages/DistribuidoresList'
import { DistribuidorDetail } from '@/pages/DistribuidorDetail'
import { ExcelenciaList } from '@/pages/ExcelenciaList'
import { MetasPanel } from '@/pages/MetasPanel'
import { EstoquePanel } from '@/pages/EstoquePanel'
import { PerformanceList } from '@/pages/PerformanceList'
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
              <Route path="/distribuidores" element={<DistribuidoresList />} />
              <Route path="/distribuidores/:id" element={<DistribuidorDetail />} />
              <Route path="/excelencia" element={<ExcelenciaList />} />
              <Route path="/metas" element={<MetasPanel />} />
              <Route path="/estoque" element={<EstoquePanel />} />
              <Route path="/performance" element={<PerformanceList />} />
              <Route path="/ingestao" element={<IngestaoPanel />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
