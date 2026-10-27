import { expect, test } from '@playwright/test';

test('homepage renders in Arabic RTL', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/بصيرة/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'الرئيسية' }).first()).toBeVisible();
});

test('reading view opens from primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /رحلة القراءة/ }).last().click();
  await expect(page.getByRole('heading', { name: 'تحديات بطل القراءة الذكي' })).toBeVisible();
});

test('screening, accessible-reader, and training views open from primary navigation', async ({ page }) => {
  await page.goto('/');

  // 1. Reading screening / diagnostic hub
  await page.getByRole('button', { name: /مؤشرات التعثر القرائي|فحص القراءة/ }).first().click();
  await expect(page.getByRole('heading', { name: /تحديات بطل القراءة الذكي/ })).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: 'بصيرة — الصفحة الرئيسية' }).click();

  // 2. Accessible reader view
  await page.getByRole('button', { name: /القارئ الميسّر/ }).last().click();
  await expect(page.getByRole('heading', { name: /القارئ العربي الميسّر/ })).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: 'بصيرة — الصفحة الرئيسية' }).click();

  // 3. Remediation training gym
  await page.getByRole('button', { name: /صالة التدريب|تدريبي/ }).last().click();
  await expect(page.getByRole('heading', { name: 'صالة تدريب وبطولات الأبطال' })).toBeVisible();
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
  expect(pageErrors).toEqual([]);
});

test('curriculum provides interactive feedback and fits a narrow mobile viewport', async ({ page }) => {
  test.setTimeout(35_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: /صالة التدريب|تدريبي/ }).last().click();
  await expect(page.getByRole('heading', { name: 'نتعلّم المهارة خطوةً خطوة' })).toBeVisible();
  await expect(page.getByTestId('curriculum-answer-option')).toHaveCount(3);
  await page.getByTestId('curriculum-answer-option').first().click();
  await expect(page.getByRole('status').last()).toBeVisible();

  const horizontalOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(horizontalOverflow).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('parental consent onboarding enforces consent before launch and school demo modal submits honestly', async ({ page }) => {
  await page.route('**/api/school-demo-request', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        message: 'تم استلام طلبكم بنجاح وسيتواصل معكم فريق حلول المدارس عبر البريد الإلكتروني الرسمي.',
      }),
    });
  });

  await page.goto('/');

  // 1. Open new learner modal from hero
  await page.getByRole('button', { name: /كمتعلّم جديد|تجربة المتعلّم/ }).first().click();
  await expect(page.getByRole('heading', { name: 'بدء رحلة متعلم جديد' })).toBeVisible();

  // Button should be disabled when consent is not given and name is empty
  const launchBtn = page.getByRole('button', { name: /انطلق في تدريب اليوم/ });
  await expect(launchBtn).toBeDisabled();

  // Enter learner alias
  await page.getByPlaceholder(/مثال: البطل الصغير أو سارة/).fill('سارة البطلة');
  // Still disabled because consent is unchecked
  await expect(launchBtn).toBeDisabled();

  // Check mandatory consent
  await page.locator('label').filter({ hasText: /أقر بصفتي ولي أمر/ }).locator('input[type="checkbox"]').check();
  await expect(launchBtn).toBeEnabled();

  // Close modal
  await page.getByRole('button', { name: 'إلغاء' }).click();

  // 2. School demo request modal
  await page.getByRole('button', { name: /طلب تجربة مدرسة/ }).click();
  await expect(page.getByRole('heading', { name: 'طلب تجربة مدرسية وشراكة تجريبية' })).toBeVisible();

  await page.getByPlaceholder(/مثال: مدرسة قطر الابتدائية/).fill('مدرسة الوكرة النموذجية');
  await page.getByPlaceholder(/مثال: أ. مريم السليطي/).fill('أ. خالد المهندي');
  await page.getByPlaceholder(/name@school.edu.qa/).fill('khalid@alwakra-school.edu.qa');
  await page.getByPlaceholder(/\+974 5500 0000/).fill('+974 55112233');

  await page.getByRole('button', { name: 'إرسال طلب التجربة' }).click();
  await expect(page.getByText('تم استلام طلبكم بنجاح!')).toBeVisible();
});
