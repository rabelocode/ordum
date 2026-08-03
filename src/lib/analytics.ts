import { sanitizeAnalyticsProperties } from './telemetryPrivacy';

export type AnalyticsEventName =
  | 'account_created'
  | 'user_invited'
  | 'user_joined_tenant'
  | 'demo_requested'
  | 'proposal_created'
  | 'contract_activated'
  | 'module_opened'
  | 'report_started'
  | 'report_submitted'
  | 'job_published'
  | 'application_started'
  | 'application_submitted'
  | 'employee_request_created'
  | 'subscription_started'
  | 'payment_confirmed'
  | 'onboarding_step_completed';

export type AnalyticsConsent = 'granted' | 'denied' | 'unknown';

const CONSENT_KEY = 'ordum_analytics_consent';
let initialized = false;
let clientPromise: Promise<typeof import('posthog-js')['default']> | null = null;

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'unknown';
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

export function isAnalyticsConfigured() {
  return Boolean((import.meta as any).env.VITE_POSTHOG_KEY);
}

export function initAnalytics() {
  const key = (import.meta as any).env.VITE_POSTHOG_KEY;
  if (!key || initialized || typeof window === 'undefined') return Boolean(key);

  initialized = true;
  clientPromise = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: (import.meta as any).env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      persistence: 'localStorage',
    });
    if (getAnalyticsConsent() === 'granted') posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
    return posthog;
  });
  return true;
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, 'unknown'>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CONSENT_KEY, consent);
  if (!initialized) initAnalytics();
  if (!initialized) return;
  void clientPromise?.then((posthog) => consent === 'granted' ? posthog.opt_in_capturing() : posthog.opt_out_capturing());
}

export function identifyAnalyticsUser(userId: string, tenantRef?: string, role?: string) {
  if (!initialized || getAnalyticsConsent() !== 'granted') return;
  void clientPromise?.then((posthog) => posthog.identify(userId, sanitizeAnalyticsProperties({ tenant_ref: tenantRef, role })));
}

export function resetAnalyticsUser() {
  if (initialized) void clientPromise?.then((posthog) => posthog.reset());
}

export function captureAnalytics(event: AnalyticsEventName, properties: Record<string, unknown> = {}) {
  if (!initialized || getAnalyticsConsent() !== 'granted') return;
  void clientPromise?.then((posthog) => posthog.capture(event, sanitizeAnalyticsProperties(properties)));
}
