import { expect, test } from '@playwright/test';

const toAr = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

test('homepage renders in Arabic RTL', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/بصيرة/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'الرئيسية' }).first()).toBeVisible();
});

test('reading view opens from primary navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /رحلة القراءة/ }).last().click();
  await expect(page.getByRole('heading', { name: 'قراءة نص وفهمه', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /قراءة نص وفهمه/ })).toHaveAttribute('aria-current', 'page');
});

test('screening, accessible-reader, and training views open from primary navigation', async ({ page }) => {
  await page.goto('/');

  // 1. Reading screening / diagnostic hub
  await page.getByRole('button', { name: /الفحص الشامل/ }).first().click();
  await expect(page.getByRole('heading', { name: /الفحص المعرفي الشامل لمهارات القراءة/ })).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: 'بصيرة — الصفحة الرئيسية' }).click();

  // 2. Accessible reader view
  await page.getByRole('button', { name: /القارئ الميسّر/ }).last().click();
  await expect(page.getByRole('heading', { name: 'القارئ الميسّر', exact: true })).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: 'بصيرة — الصفحة الرئيسية' }).click();

  // 3. Remediation training gym
  await page.getByRole('button', { name: /صالة التدريب|تدريبي/ }).last().click();
  await expect(page.getByRole('heading', { name: 'صالة التدريب', exact: true })).toBeVisible();
});

test('daily sprint can reach its finish card without a Trophy runtime error or fake streak', async ({ page }) => {
  test.setTimeout(35_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');

  await page.getByRole('button', { name: 'صالة التدريب' }).first().click();
  await page.getByRole('tab', { name: /ألعاب المهارات/ }).click();
  await page.getByRole('button', { name: /تحدي الدقائق الخمس/ }).click();
  await expect(page.getByRole('heading', { name: 'تحدي الدقائق الخمس اليومي' })).toBeVisible();
  await expect(page.getByText(/سلسلة الالتزام:\s*[4٤]/)).toHaveCount(0);

  const targetWords = ['سَيْفٌ', 'صَابُونٌ', 'تِينٌ', 'طَبِيبٌ', 'دَلَّ', 'كَلْبٌ', 'حَمَلَ', 'ذَلَّ'];
  for (let i = 0; i < targetWords.length; i += 1) {
    const target = page.getByText(targetWords[i], { exact: true });
    await expect(target).toBeVisible();
    await target.locator('xpath=..').getByRole('button', { name: /اخْتَرْ هَذِهِ الكَلِمَة/ }).click();
    if (i < targetWords.length - 1) {
      await expect(page.getByText(`تمرين ${toAr(i + 2)} من ٨`)).toBeVisible();
    }
  }

  const nextWord = page.getByRole('button', { name: /نطقت الكلمة بنجاح، التالية/ });
  await expect(nextWord).toBeVisible();
  for (let i = 0; i < 60 && await nextWord.isVisible(); i += 1) {
    await nextWord.click();
  }

  await expect(page.getByRole('button', { name: /إنهاء تحدي اليوم/ })).toBeVisible();
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
  await page.getByPlaceholder(/مثال: سارة أو أحمد/).fill('سارة');
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

test('cognitive battery: setup, nine-game map, and training program entry', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /الفحص الشامل/ }).first().click();
  const start = page.getByRole('button', { name: 'بدء الفحص' });
  await expect(start).toBeDisabled();
  await page.getByLabel('اسم الطفل أو لقبه').fill('سارة');
  for (const label of [/المكان هادئ/, /الصوت واضح/, /الطفل مرتاح ومستعد/, /موافقة ولي الأمر/]) {
    await page.getByLabel(label).check();
  }
  await start.click();
  for (const game of ['نوافذ القلعة', 'بيوت الحيوانات', 'ببغاء الحديقة', 'أصدقاء الفضاء', 'كلمات تتشابه', 'مختبر الأصوات', 'الأذن الذهبية', 'عين الصقر', 'صندوق الحروف']) {
    await expect(page.getByText(game, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'الملف المعرفي والتقرير' })).toBeDisabled();
  await page.getByRole('button', { name: 'البرنامج التدريبي' }).first().click();
  await expect(page.getByRole('heading', { name: /البرنامج التدريبي الموجّه/ }).first()).toBeVisible();
});

test('guided reader shows one sentence at a time and walks through the micro-steps', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /القارئ الميسّر/ }).last().click();
  // The start button is on screen without scrolling.
  await expect(page.getByRole('button', { name: /ابدأ القراءة/ })).toBeInViewport();
  await page.getByRole('button', { name: /ابدأ القراءة/ }).click();

  // Reading opens at the sentence: site header and footer hidden, page at the top.
  await expect(page.getByText(/الجملة ١ من/)).toBeInViewport();
  await expect(page.locator('.baseera-footer')).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: /أنا جاهز للقراءة/ }).click();
  // Read with me: advance word by word until the sentence is finished.
  for (let i = 0; i < 15; i += 1) {
    const next = page.getByRole('button', { name: /الكلمة التالية/ });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  await page.getByRole('button', { name: /أنهيت الجملة/ }).click();
  await page.getByRole('button', { name: /^قرأتها/ }).click();
  await expect(page.getByRole('button', { name: /استمع إلى الكلمة/ })).toBeVisible();
  await page.locator('section.rounded-3xl .grid button').first().click();
  await page.getByRole('button', { name: /الجملة التالية/ }).click();
  await expect(page.getByText(/الجملة ٢ من/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('teachers can reach the login on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'دخول المعلم' })).toBeVisible();
});

test('content review page lists every unit and records a decision', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/?review=1');
  await expect(page.getByRole('heading', { name: 'مراجعة محتوى بصيرة' })).toBeVisible();
  await expect(page.getByText(/رُوجع ٠ من ٨٣٧/)).toBeVisible();
  await page.getByRole('button', { name: 'صحيح' }).first().click();
  await expect(page.getByText(/رُوجع ١ من ٨٣٧/)).toBeVisible();
});
