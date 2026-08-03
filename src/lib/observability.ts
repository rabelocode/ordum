import { sanitizeSentryEvent } from './telemetryPrivacy';

declare const __ORDUM_RELEASE__: string;

let initialized = false;
let sentryPromise: Promise<typeof import('@sentry/react')> | null = null;

export function initClientObservability() {
  const dsn = (import.meta as any).env.VITE_SENTRY_DSN;
  if (!dsn || initialized) return Boolean(dsn);

  sentryPromise = import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: (import.meta as any).env.VITE_APP_ENVIRONMENT || (import.meta as any).env.MODE,
      release: typeof __ORDUM_RELEASE__ === 'string' ? __ORDUM_RELEASE__ : undefined,
      sendDefaultPii: false,
      tracesSampleRate: 0,
      ignoreErrors: [/Invalid login credentials/i, /Email rate limit exceeded/i, /JWT expired/i],
      beforeSend(event) {
        return sanitizeSentryEvent(event as Record<string, any>) as any;
      },
    });
    return Sentry;
  });
  initialized = true;
  return true;
}

export function captureClientException(error: unknown, context: Record<string, string> = {}) {
  if (!initialized) return;
  void sentryPromise?.then((Sentry) => Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => scope.setTag(key, value.slice(0, 128)));
    Sentry.captureException(error);
  }));
}
