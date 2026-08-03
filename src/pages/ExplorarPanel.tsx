import { Map, Target, PieChart } from 'lucide-react'
import { PageHeader } from '@/components/distribuidor/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function ExplorarEmptyState({
  titulo,
  descricao,
  icon: Icon,
}: {
  titulo: string
  descricao: string
  icon: typeof Map
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-navy/8">
        <Icon className="h-5 w-5 text-navy/70" />
      </div>
      <h3 className="font-display text-base font-normal text-foreground">{titulo}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">{descricao}</p>
    </div>
  )
}

export function ExplorarPanel() {
  return (
    <div className="animate-page-in">
      <PageHeader
        eyebrow="Inteligência de PDV"
        title="Explorar"
        accent="território"
        description="quem poderia comprar — priorização e cobertura na praça"
      />

      <div className="mb-5 rounded-lg border border-border/60 bg-gradient-to-br from-navy/[0.03] to-teal/[0.04] px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal/90">
          Diferente do Insights
        </p>
        <h2 className="mt-1 font-display text-base font-normal text-foreground">
          Potencial estimado, não histórico demonstrado
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          O <strong className="font-medium text-foreground">Insights</strong> mostra o que a operação
          anterior já vendeu (jan/2022–dez/2024). O <strong className="font-medium text-foreground">Explorar</strong>{' '}
          responde: dos PDVs qualificados na praça de atuação do parceiro, quais ainda não são atendidos
          como o potencial indica — e onde está o gap por microrregião.
        </p>
      </div>

      <Tabs defaultValue="mapa" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger
            value="mapa"
            className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <Map className="h-3.5 w-3.5" />
            Mapa
          </TabsTrigger>
          <TabsTrigger
            value="prioridade"
            className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <Target className="h-3.5 w-3.5" />
            Prioridade
          </TabsTrigger>
          <TabsTrigger
            value="cobertura"
            className="gap-1.5 data-[state=active]:bg-navy data-[state=active]:text-white"
          >
            <PieChart className="h-3.5 w-3.5" />
            Cobertura
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mapa">
          <ExplorarEmptyState
            icon={Map}
            titulo="Mapa de potencial não atendido"
            descricao="Calor de potencial estimado nas cidades do parceiro, com PDVs já atendidos em cor distinta. Pontos só quando a geocodificação for confiável; caso contrário, agregação por bairro."
          />
        </TabsContent>

        <TabsContent value="prioridade">
          <ExplorarEmptyState
            icon={Target}
            titulo="Ranking de subexplorados"
            descricao="Clientes da carteira com potencial alto e compra abaixo de 50% do estimado, ordenados pelo gap em reais. Filtros por rota e vendedor."
          />
        </TabsContent>

        <TabsContent value="cobertura">
          <ExplorarEmptyState
            icon={PieChart}
            titulo="Painel de cobertura"
            descricao="Percentual de PDVs qualificados atendidos por bairro e grupo de CNAE nas cidades de atuação do parceiro, comparado à média dos demais territórios."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
