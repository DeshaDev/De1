import { expect, test } from '@playwright/test';

test('homepage renders in Arabic RTL', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/بصيرة/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'الرئيسية' }).first()).toBeVisible();
});

test('reading view opens from primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'القراءة', exact: true }).first().click();
  await expect(page.getByText('مختبر القراءة والطلاقة والفهم القرائي')).toBeVisible();
});
