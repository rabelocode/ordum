import { expect, test } from '@playwright/test';

const matrix = [
  { role: 'tenant_admin', allowed: ['Integridade', 'Pessoas', 'Talentos'], denied: [] },
  { role: 'manager', allowed: ['Pessoas'], denied: ['Integridade', 'Talentos'] },
  { role: 'employee', allowed: ['Pessoas'], denied: ['Integridade', 'Talentos'] },
  { role: 'recruiter', allowed: ['Talentos'], denied: ['Integridade', 'Pessoas'] },
  { role: 'compliance', allowed: ['Integridade'], denied: ['Pessoas', 'Talentos'] },
] as const;

for (const fixture of matrix) {
  test(`${fixture.role} sees only authorized pilot modules`, async ({ page }) => {
    await page.addInitScript((role) => {
      localStorage.setItem('ordum_e2e_role', role);
      localStorage.setItem('ordum_active_tenant', '30000000-0000-4000-8000-000000000099');
    }, fixture.role);
    await page.route('https://example.supabase.co/**', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/#/workspace');
    await expect(page.getByRole('heading', { name: 'Ordum Pilot Trial' })).toBeVisible();
    for (const module of fixture.allowed) await expect(page.getByText(module, { exact: true }).first()).toBeVisible();
    for (const module of fixture.denied) await expect(page.getByText(module, { exact: true })).toHaveCount(0);
  });
}

test('employee direct module access is denied and cannot select another tenant from local preference', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ordum_e2e_role', 'employee');
    localStorage.setItem('ordum_active_tenant', '30000000-0000-4000-8000-000000000099');
  });
  await page.goto('/#/workspace/talentos');
  await expect(page.getByText('Acesso Restrito')).toBeVisible();
  await expect(page.getByText('Ordum Pilot Trial')).toBeVisible();
  await expect(page.getByText('Tenant externo')).toHaveCount(0);
});
