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


test('daily sprint can reach its finish card without a Trophy runtime error or fake streak', async ({ page }) => {
  test.setTimeout(35_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: 'سبرنت اليوم', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تحدي الدقائق الخمس اليومي' })).toBeVisible();
  await expect(page.getByText(/سلسلة الالتزام:\s*4/)).toHaveCount(0);

  const targetWords = ['سَيْفٌ', 'صَابُونٌ', 'تِينٌ', 'طَبِيبٌ', 'دَلَّ', 'كَلْبٌ', 'حَمَلَ', 'ذَلَّ'];
  for (let i = 0; i < targetWords.length; i += 1) {
    const target = page.getByText(targetWords[i], { exact: true });
    await expect(target).toBeVisible();
    await target.locator('xpath=..').getByRole('button', { name: /اخْتَرْ هَذِهِ الكَلِمَة/ }).click();
    if (i < targetWords.length - 1) {
      await expect(page.getByText(`تمرين ${i + 2} من 8`)).toBeVisible();
    }
  }

  const nextWord = page.getByRole('button', { name: /نطقت الكلمة بنجاح، التالية/ });
  await expect(nextWord).toBeVisible();
  for (let i = 0; i < 60 && await nextWord.isVisible(); i += 1) {
    await nextWord.click();
  }

  await expect(page.getByRole('button', { name: /إتمام سبرنت اليوم/ })).toBeVisible();
  expect(pageErrors.filter((message) => message.includes('Trophy is not defined'))).toEqual([]);
});
