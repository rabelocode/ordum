import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { captureClientException } from '../../lib/observability';
import { Button } from '../ui/Button';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class WorkspaceErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureClientException(error, { boundary: 'workspace', component_stack_present: String(Boolean(errorInfo.componentStack)) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF8F3] p-4">
        <section className="w-full max-w-md rounded-2xl border border-[#DDD8CF]/50 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertTriangle className="h-8 w-8" /></div>
          <h1 className="mb-2 text-xl font-bold text-[#202322]">Não foi possível exibir o workspace</h1>
          <p className="mb-6 text-sm text-gray-500">O erro foi isolado e não exibiremos detalhes técnicos ou dados do tenant nesta tela.</p>
          <Button onClick={() => { window.location.hash = '#/'; window.location.reload(); }} className="w-full">Voltar ao início</Button>
        </section>
      </main>
    );
  }
}
