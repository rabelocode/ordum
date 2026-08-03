import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyticsEventProperties, redactTelemetryValue, sanitizeAnalyticsProperties, sanitizeSentryEvent } from '../src/lib/telemetryPrivacy';

test('analytics accepts only documented non-sensitive dimensions', () => {
  assert.deepEqual(sanitizeAnalyticsProperties({
    tenant_ref: 'tenant-safe-ref',
    module: 'integrity',
    status: 'submitted',
    email: 'should-not-leave@example.com',
    report_text: 'sensitive report',
  }), {
    tenant_ref: 'tenant-safe-ref',
    module: 'integrity',
    status: 'submitted',
  });
});

test('analytics disables GeoIP enrichment and still rejects arbitrary properties', () => {
  assert.deepEqual(buildAnalyticsEventProperties({ module: 'people', current_url: '/private', email: 'private@example.com' }), {
    module: 'people',
    $geoip_disable: true,
  });
});

test('recursive telemetry sanitization redacts sensitive fields', () => {
  const result = redactTelemetryValue({ nested: { password: 'secret', safe: 'ok' }, token: 'private' });
  assert.deepEqual(result, { nested: { password: '[REDACTED]', safe: 'ok' }, token: '[REDACTED]' });
});

test('Sentry events keep only the user identifier and remove request payloads', () => {
  const result = sanitizeSentryEvent({
    user: { id: 'user-ref', email: 'private@example.com' },
    request: { data: { report_text: 'private' }, headers: { authorization: 'private' }, url: '/api/test' },
  });
  assert.deepEqual(result.user, { id: 'user-ref' });
  assert.equal(result.request.url, '/api/test');
  assert.equal(result.request.data, undefined);
  assert.equal(result.request.headers, undefined);
});

test('controlled Sentry errors redact credentials and direct identifiers', () => {
  const result = sanitizeSentryEvent({
    exception: { values: [{ type: 'PilotControlledError', value: 'authorization=private user@example.com' }] },
    breadcrumbs: [{ message: 'Bearer abc.def.ghi' }],
  });
  assert.equal(result.exception.values[0].value, 'authorization=[REDACTED] [EMAIL_REDACTED]');
  assert.equal(result.breadcrumbs[0].message, '[REDACTED]');
});
