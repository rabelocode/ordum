import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './core/auth/AuthProvider';
import { TenantProvider } from './core/auth/TenantProvider';
import { AnalyticsConsentBanner } from './components/AnalyticsConsentBanner';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { initAnalytics } from './lib/analytics';
import { initClientObservability } from './lib/observability';
import './index.css';

initClientObservability();
initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <TenantProvider>
          <ToastProvider>
            <App />
            <AnalyticsConsentBanner />
          </ToastProvider>
        </TenantProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
