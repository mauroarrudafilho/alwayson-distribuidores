import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useParams,
  useLocation,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireAdmin } from '@/components/auth/RequireAdmin'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { RecuperarPassword } from '@/pages/RecuperarPassword'
import { RedefinirPassword } from '@/pages/RedefinirPassword'
import { AceitarConvite } from '@/pages/AceitarConvite'
import { Conta } from '@/pages/Conta'
import { Dashboard } from '@/pages/Dashboard'
import { Performance } from '@/pages/Performance'
import { ClientesEstrategicos } from '@/pages/ClientesEstrategicos'
import { ClientesBusca } from '@/pages/ClientesBusca'
import { ClienteDetalhe } from '@/pages/ClienteDetalhe'
import { EstoquePanel } from '@/pages/EstoquePanel'
import { Admin } from '@/pages/Admin'
import { AdminDistribuidores } from '@/pages/admin/AdminDistribuidores'
import { AdminProdutos } from '@/pages/admin/AdminProdutos'
import { AdminMetas } from '@/pages/admin/AdminMetas'
import { AdminUsuarios } from '@/pages/admin/AdminUsuarios'
import { AdminAjustesCadastro } from '@/pages/admin/AdminAjustesCadastro'
import { AdminAjustesLayout } from '@/pages/admin/AdminAjustesLayout'
import { AdminDeParaProdutos } from '@/pages/admin/AdminDeParaProdutos'
import { AdminInsightsDeParaProdutos } from '@/pages/admin/AdminInsightsDeParaProdutos'
import { AdminInsightsCadastroClientes } from '@/pages/admin/AdminInsightsCadastroClientes'
import { AdminInsightsRedes } from '@/pages/admin/AdminInsightsRedes'
import { AdminAjustesRedesTemplateVendas } from '@/pages/admin/AdminAjustesRedesTemplateVendas'
import { AdminDistribuidorLayout } from '@/pages/admin/AdminDistribuidorLayout'
import { AdminDistribuidorResumo } from '@/pages/admin/AdminDistribuidorResumo'
import { AdminDistribuidorHierarquia } from '@/pages/admin/AdminDistribuidorHierarquia'
import { AdminDistribuidorIngestao } from '@/pages/admin/AdminDistribuidorIngestao'
import { AdminInsightsLayout } from '@/pages/admin/AdminInsightsLayout'
import { AdminExplorarLayout } from '@/pages/admin/AdminExplorarLayout'
import { AdminExplorarDesconsiderados } from '@/pages/admin/AdminExplorarDesconsiderados'
import { InsightsPanel } from '@/pages/InsightsPanel'
import { ExplorarPanel } from '@/pages/ExplorarPanel'

/** `/admin/distribuidores/:id/...` → `/parceiros/:id/...`, preservando a sub-rota. */
function RedirecionaParceiro() {
  const { distribuidorId } = useParams<{ distribuidorId: string }>()
  const location = useLocation()
  const resto = location.pathname.split(`/admin/distribuidores/${distribuidorId}`)[1] ?? ''
  return <Navigate to={`/parceiros/${distribuidorId}${resto}`} replace />
}

function AdminLegacyDeParaProdutos() {
  const [sp] = useSearchParams()
  const id = sp.get('distribuidor')
  if (id) {
    return <Navigate to={`/admin/distribuidores/${id}/de-para-produtos`} replace />
  }
  return <Navigate to="/admin/distribuidores" replace />
}

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
                  {/* Metas é acompanhamento, não configuração — mora na Análise.
                      O caminho por distribuidor continua em /admin para o cadastro. */}
                  <Route path="/metas" element={<AdminMetas />} />
                  {/* A Excelência virou uma lista curada de clientes estratégicos —
                      o caminho antigo continua a funcionar. */}
                  <Route path="/clientes-estrategicos" element={<ClientesEstrategicos />} />
                  <Route
                    path="/excelencia"
                    element={<Navigate to="/clientes-estrategicos" replace />}
                  />
                  <Route path="/clientes" element={<ClientesBusca />} />
                  <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                  <Route path="/estoque" element={<EstoquePanel />} />
                  {/* Parceiros: o que pertence a um distribuidor vive aqui, fora de
                      Administração — que fica só com o que é da plataforma. */}
                  <Route path="/parceiros" element={<AdminDistribuidores />} />
                  <Route path="/parceiros/:distribuidorId" element={<AdminDistribuidorLayout />}>
                    <Route index element={<AdminDistribuidorResumo />} />
                    <Route path="de-para-produtos" element={<AdminDeParaProdutos />} />
                    <Route path="metas" element={<AdminMetas />} />
                    <Route path="ingestao" element={<AdminDistribuidorIngestao />} />
                    <Route path="hierarquia" element={<AdminDistribuidorHierarquia />} />
                  </Route>

                  <Route path="/admin" element={<RequireAdmin />}>
                    <Route element={<Admin />}>
                    <Route index element={<Navigate to="/admin/distribuidores" replace />} />
                    {/* Link salvo continua funcionando. */}
                    <Route path="distribuidores" element={<Navigate to="/parceiros" replace />} />
                    <Route
                      path="distribuidores/:distribuidorId/*"
                      element={<RedirecionaParceiro />}
                    />
                    <Route path="insights" element={<AdminInsightsLayout />}>
                      <Route
                        index
                        element={<Navigate to="/admin/insights/de-para-produtos" replace />}
                      />
                      <Route
                        path="de-para-produtos"
                        element={<AdminInsightsDeParaProdutos />}
                      />
                      <Route
                        path="cadastro-clientes"
                        element={<AdminInsightsCadastroClientes />}
                      />
                      <Route path="redes" element={<AdminInsightsRedes />} />
                      <Route
                        path="excluir-clientes"
                        element={<Navigate to="/admin/insights/cadastro-clientes" replace />}
                      />
                    </Route>
                    <Route path="explorar" element={<AdminExplorarLayout />}>
                      <Route
                        index
                        element={<Navigate to="/admin/explorar/desconsiderados" replace />}
                      />
                      <Route path="desconsiderados" element={<AdminExplorarDesconsiderados />} />
                    </Route>
                    <Route path="produtos" element={<AdminProdutos />} />
                    <Route
                      path="excelencia"
                      element={<Navigate to="/clientes-estrategicos" replace />}
                    />
                    <Route path="usuarios" element={<AdminUsuarios />} />
                    <Route path="ajustes-cadastro" element={<AdminAjustesLayout />}>
                      <Route index element={<AdminAjustesCadastro />} />
                      <Route
                        path="redes-template-vendas"
                        element={<AdminAjustesRedesTemplateVendas />}
                      />
                      <Route
                        path="redes-insights"
                        element={
                          <Navigate to="/admin/ajustes-cadastro/redes-template-vendas" replace />
                        }
                      />
                    </Route>
                    <Route path="de-para-produtos" element={<AdminLegacyDeParaProdutos />} />
                    <Route
                      path="de-para-insights-produtos"
                      element={<Navigate to="/admin/insights/de-para-produtos" replace />}
                    />
                    <Route
                      path="excluir-insights-clientes"
                      element={<Navigate to="/admin/insights/cadastro-clientes" replace />}
                    />
                    <Route path="metas" element={<Navigate to="/metas" replace />} />
                    </Route>
                  </Route>
                  <Route path="/ingestao" element={<Navigate to="/parceiros" replace />} />
                  <Route path="/insights" element={<InsightsPanel />} />
                  <Route path="/explorar" element={<ExplorarPanel />} />
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
