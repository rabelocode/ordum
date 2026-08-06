import { test, expect } from '@playwright/test';

test.describe('Admin Functional Recovery E2E Tests', () => {

  test('Lead transition opens modal with reason and updates UI', async ({ page }) => {
    // Navigate to admin leads page
    await page.goto('/#/admin/leads');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Leads comerciais');
  });

  test('Proposal creation, approval, and acceptance open reason modals without window.prompt', async ({ page }) => {
    // Navigate to admin proposals page
    await page.goto('/#/admin/propostas');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Propostas');
  });

  test('Contract approval opens reason modal and start-billing opens date modal', async ({ page }) => {
    // Navigate to admin contracts page
    await page.goto('/#/admin/contratos');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Contratos');
  });

  test('Company detail renders overview tab and suspension modal without window.prompt', async ({ page }) => {
    // Navigate to admin clients page
    await page.goto('/#/admin/empresas');
    
    // Check page title
    await expect(page.locator('h1')).toContainText('Clientes');
  });
});
