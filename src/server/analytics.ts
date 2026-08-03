import type { AnalyticsEventName } from '../lib/analytics';
import { sanitizeAnalyticsProperties } from '../lib/telemetryPrivacy';

export async function captureServerAnalytics(event: AnalyticsEventName, distinctId: string, properties: Record<string, unknown> = {}) {
  const apiKey = process.env.POSTHOG_PROJECT_KEY;
  if (!apiKey || !distinctId) return false;
  const host = (process.env.POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  try {
    const response = await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        properties: { distinct_id: distinctId.slice(0, 128), ...sanitizeAnalyticsProperties(properties) },
      }),
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}
