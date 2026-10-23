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

test('math, accessible-reader, and training views open from primary navigation', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'الحساب', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'مهام استكشافية للإدراك العددي' })).toBeVisible();

  await page.getByRole('button', { name: 'القارئ الميسّر', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: /القارئ العربي الميسّر/ })).toBeVisible();

  await page.getByRole('button', { name: 'التدريب', exact: true }).first().click();
  await expect(page.getByText('التدريب المتدرّج للقراءة والحساب')).toBeVisible();
});
