import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

const TEXT = {
  title: 'Algo deu errado',
  description: 'A aplicação encontrou um erro inesperado ao renderizar. Recarregue para tentar novamente.',
  reload: 'Recarregar',
} as const;

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

/**
 * Boundary de erro no topo da árvore: converte qualquer erro de render em uma
 * UI de fallback visível, evitando tela branca (app fica inutilizável e sem feedback).
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro de render capturado:', error, info?.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-50 p-6">
        <div className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">{TEXT.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{TEXT.description}</p>
          {this.state.message && (
            <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-left text-xs text-slate-500 whitespace-pre-wrap break-words">
              {this.state.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-all hover:from-cyan-500 hover:to-teal-500"
          >
            <RotateCcw className="h-4 w-4" />
            {TEXT.reload}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
