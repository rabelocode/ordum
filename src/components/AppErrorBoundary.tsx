import React, { type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/Button';
import { captureClientException } from '../lib/observability';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureClientException(error, { boundary: 'application', component_stack_present: String(Boolean(info.componentStack)) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F6F5F2] p-5">
        <section className="w-full max-w-md rounded-3xl border border-[#DDD8CF] bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0EC] text-[#A9412F]"><AlertTriangle /></div>
          <h1 className="text-xl font-black text-[#202322]">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm text-[#626866]">O erro foi isolado. Tente novamente; se persistir, informe o horário ao suporte.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => { window.location.hash = '#/'; window.location.reload(); }}>Ir para o início</Button>
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          </div>
        </section>
      </main>
    );
  }
}
