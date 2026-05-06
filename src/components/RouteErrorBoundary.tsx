import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  children: ReactNode
  resetKey?: string
}

interface State {
  error: Error | null
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Mantemos o stack no console pra inspeção; o boundary já preserva
    // o AuthProvider, então um crash de página não te desloga mais.
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
        <div className="max-w-md space-y-5 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground editorial-rule">
            Erro inesperado
          </p>
          <h1
            className="text-[32px] leading-[1.05] tracking-[-0.02em] text-foreground"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 360,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            Esta página{' '}
            <em
              className="italic text-navy"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 50' }}
            >
              travou.
            </em>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sua sessão segue ativa — apenas o conteúdo desta tela falhou. Você pode tentar de novo
            ou voltar ao painel.
          </p>
          <pre className="max-h-32 overflow-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-[11px] leading-relaxed text-muted-foreground">
            {error.message || String(error)}
          </pre>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md border border-foreground/15 bg-foreground/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-foreground transition hover:bg-foreground/10"
            >
              Tentar novamente
            </button>
            <Link
              to="/"
              onClick={this.reset}
              className="rounded-md bg-foreground px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-background transition hover:bg-foreground/85"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
