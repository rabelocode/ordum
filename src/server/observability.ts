import * as Sentry from '@sentry/node';
import type { Express, Request } from 'express';
import { sanitizeSentryEvent } from '../lib/telemetryPrivacy';

let initialized = false;

export function initServerObservability() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || initialized) return Boolean(dsn);
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 20,
    beforeSend(event) {
      return sanitizeSentryEvent(event as Record<string, any>) as any;
    },
    beforeBreadcrumb(breadcrumb) {
      return sanitizeSentryEvent({ breadcrumb }).breadcrumb as any;
    },
  });
  initialized = true;
  return true;
}

export function reportServerError(error: unknown, request?: Request, operation?: string) {
  const safeMessage = error instanceof Error ? error.message.replace(/(token|secret|password|authorization)=[^\s&]+/gi, '$1=[REDACTED]').slice(0, 300) : 'Unknown error';
  const requestId = request ? String((request as any).requestId || '') : '';

  console.error(JSON.stringify({
    level: 'error',
    message: safeMessage,
    method: request?.method,
    operation,
    requestId,
    route: request?.path,
  }));

  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (operation) scope.setTag('operation', operation.slice(0, 128));
    if (requestId) scope.setTag('request_id', requestId.slice(0, 128));
    if (request?.method) scope.setTag('http.method', request.method);
    if (request?.path) scope.setTag('http.route', request.path.slice(0, 256));
    Sentry.captureException(error);
  });
}

export function installServerErrorHandler(app: Express) {
  if (initialized) Sentry.setupExpressErrorHandler(app);
}
