import { useState } from 'react';
import { Button } from './ui/Button';
import { getAnalyticsConsent, isAnalyticsConfigured, setAnalyticsConsent } from '../lib/analytics';

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(() => isAnalyticsConfigured() && getAnalyticsConsent() === 'unknown');
  if (!visible) return null;

  const decide = (consent: 'granted' | 'denied') => {
    setAnalyticsConsent(consent);
    setVisible(false);
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl rounded-2xl border border-[#DDD8CF] bg-[#FFFCF5] p-4 shadow-2xl sm:flex sm:items-center sm:gap-5" role="dialog" aria-label="Preferências de métricas">
      <p className="flex-1 text-sm leading-relaxed text-[#353938]">
        A Ordum usa métricas de produto sem conteúdo de denúncias, documentos, currículos ou dados de contato. Você pode aceitar ou recusar.
      </p>
      <div className="mt-3 flex gap-2 sm:mt-0">
        <Button variant="outline" size="sm" onClick={() => decide('denied')}>Recusar</Button>
        <Button size="sm" onClick={() => decide('granted')}>Aceitar métricas</Button>
      </div>
    </aside>
  );
}
