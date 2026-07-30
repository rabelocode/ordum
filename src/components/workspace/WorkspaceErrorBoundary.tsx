// @ts-nocheck
import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WorkspaceErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in workspace:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-[#DDD8CF]/50">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-[#202322] mb-2">Erro de exibição</h1>
            <p className="text-sm text-gray-500 mb-6">
              Não foi possível carregar o ambiente de demonstração corretamente.
            </p>
            <div className="text-left text-xs bg-gray-50 p-3 rounded-lg mb-6 overflow-auto max-h-32 text-red-600 font-mono">
              {this.state.error?.message}
            </div>
            <Button 
              onClick={() => {
                window.location.hash = "#/entrar";
              }} 
              className="w-full"
            >
              Voltar para identificação
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
