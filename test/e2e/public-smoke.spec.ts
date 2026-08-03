import { expect, test } from '@playwright/test';

for (const route of ['/#/', '/#/entrar', '/#/admin']) {
  test(`${route} renders meaningful content without a white screen`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('body')).not.toContainText('Não foi possível abrir esta tela');
    expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(80);
    expect(pageErrors).toEqual([]);
  });
}

test('server bundles and source maps are not exposed by the static deployment', async ({ request }) => {
  for (const path of ['/server.cjs', '/server.cjs.map']) {
    const response = await request.get(path);
    const body = await response.text();
    expect(body).not.toContain('requirePlatformAuth');
    expect(body).not.toContain('sourcesContent');
    expect(body).not.toContain('SUPABASE_SECRET_KEY');
  }
});

test('security headers and malformed JSON handling are active', async ({ request }) => {
  const home = await request.get('/');
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['x-frame-options']).toBe('DENY');
  const invalid = await request.post('/api/invalid-json', {
    headers: { 'content-type': 'application/json' },
    data: '{',
  });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toMatchObject({ error: 'Invalid JSON body' });
});
