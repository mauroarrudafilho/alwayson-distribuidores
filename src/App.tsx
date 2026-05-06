import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { RecuperarPassword } from '@/pages/RecuperarPassword'
import { RedefinirPassword } from '@/pages/RedefinirPassword'
import { AceitarConvite } from '@/pages/AceitarConvite'
import { Conta } from '@/pages/Conta'
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
import { AdminAjustesCadastro } from '@/pages/admin/AdminAjustesCadastro'
import { AdminDeParaProdutos } from '@/pages/admin/AdminDeParaProdutos'
import { AdminInsightsDeParaProdutos } from '@/pages/admin/AdminInsightsDeParaProdutos'
import { AdminInsightsExcluirClientes } from '@/pages/admin/AdminInsightsExcluirClientes'
import { IngestaoPanel } from '@/pages/IngestaoPanel'
import { InsightsPanel } from '@/pages/InsightsPanel'

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
      <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/recuperar-password" element={<RecuperarPassword />} />
              <Route path="/redefinir-password" element={<RedefinirPassword />} />
              <Route path="/aceitar-convite/:token" element={<AceitarConvite />} />

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/conta" element={<Conta />} />
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
                    <Route path="ajustes-cadastro" element={<AdminAjustesCadastro />} />
                    <Route path="de-para-produtos" element={<AdminDeParaProdutos />} />
                    <Route
                      path="de-para-insights-produtos"
                      element={<AdminInsightsDeParaProdutos />}
                    />
                    <Route
                      path="excluir-insights-clientes"
                      element={<AdminInsightsExcluirClientes />}
                    />
                  </Route>
                  <Route path="/ingestao" element={<IngestaoPanel />} />
                  <Route path="/insights" element={<InsightsPanel />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
