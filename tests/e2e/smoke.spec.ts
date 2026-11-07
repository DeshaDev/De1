import { expect, test } from '@playwright/test';

async function installSchoolTestSession(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('baseera_session_v1', JSON.stringify({
      token: 'playwright-test-session',
      role: 'school_admin',
      accountName: 'مسؤول الاختبار',
      tenantId: 'school_a',
      tenantDisplayNameAr: 'مدرسة الاختبار',
      sessionId: 'a'.repeat(32),
      scopes: ['students:read', 'students:write', 'ai:analyze'],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000,
    }));
  });
}

const toAr = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

test('homepage renders in Arabic RTL', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/هَيَّا نَقْرَأْ/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('button', { name: 'الرئيسية' }).first()).toBeVisible();
});

test('oral reading assessment opens from the screening hub footer navigation', async ({ page }) => {
  await installSchoolTestSession(page);
  await page.goto('/');
  await page.locator('.baseera-footer').getByRole('button', { name: 'فحص القراءة الجهرية', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'قراءة نص وفهمه', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'قراءة نص وفهمه', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('screening, accessible-reader, and training views open from primary navigation', async ({ page }) => {
  await installSchoolTestSession(page);
  await page.goto('/');

  // 1. Reading screening / diagnostic hub
  await page.getByRole('button', { name: /فحص مؤشرات عسر القراءة/ }).first().click();
  await expect(page.getByRole('heading', { name: /فحص مؤشرات عسر القراءة/ }).first()).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: /الصفحة الرئيسية/ }).click();

  // 2. Accessible reader view
  await page.getByRole('button', { name: /القارئ الميسّر/ }).last().click();
  await expect(page.getByRole('heading', { name: 'القارئ الميسّر', exact: true })).toBeVisible();

  // Return to home
  await page.getByRole('link', { name: /الصفحة الرئيسية/ }).click();

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

  await page.getByRole('button', { name: /صالة التدريب/ }).last().click();
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

test('parent registration limits the screening age range and requires explicit guardian consent', async ({ page }) => {
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

  await page.goto('/parent');
  await expect(page.getByRole('heading', { name: 'هَيَّا نَقْرَأْ — رحلة طفلك', exact: true })).toBeVisible();

  await expect(page.getByRole('button', { name: /٤ سنوات/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /٨ سنوات/ })).toBeVisible();
  for (const age of [/٩ سنوات/, /١٠ سنوات/, /١١ سنوات/, /١٢ سنوات/]) {
    await expect(page.getByRole('button', { name: age })).toHaveCount(0);
  }

  await page.getByLabel(/اسم الطفل المستعار أو اللقب/).fill('سارة');
  await page.getByRole('button', { name: /٦ سنوات/ }).click();
  await page.getByPlaceholder('parent@example.com').fill('parent@example.test');
  await page.locator('input[type="password"]').first().fill('safe-test-password');
  const guardianConsent = page.locator('label').filter({ hasText: /أوافق بصفتي ولي أمر الطفل/ }).locator('input[type="checkbox"]');
  await expect(guardianConsent).not.toBeChecked();
  await page.getByRole('button', { name: /حفظ الطفل في السحابة وبدء الفحص/ }).click();
  await expect(page.getByRole('alert')).toContainText('اختر اللهجة الأساسية في المنزل');
  await page.getByRole('button', { name: 'سعودية / خليجية', exact: true }).click();
  await page.getByRole('button', { name: /حفظ الطفل في السحابة وبدء الفحص/ }).click();
  await expect(page.getByRole('alert')).toContainText('يرجى تأكيد موافقة ولي الأمر');

  await page.goto('/');
  await page.getByRole('button', { name: /طلب تجربة مدرسة/ }).click();
  await expect(page.getByRole('heading', { name: 'طلب تجربة مدرسية وشراكة تجريبية' })).toBeVisible();
  await page.getByPlaceholder(/مثال: مدرسة قطر الابتدائية/).fill('مدرسة الوكرة النموذجية');
  await page.getByPlaceholder(/مثال: أ. مريم السليطي/).fill('أ. خالد المهندي');
  await page.getByPlaceholder(/name@school.edu.qa/).fill('khalid@alwakra-school.edu.qa');
  await page.getByPlaceholder(/\+974 5500 0000/).fill('+974 55112233');
  await page.getByRole('button', { name: 'إرسال طلب التجربة' }).click();
  await expect(page.getByText('تم استلام طلبكم بنجاح!')).toBeVisible();
});

test('cognitive battery: setup, game map with the reading sitting first at six, and training program entry', async ({ page }) => {
  await installSchoolTestSession(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /فحص مؤشرات عسر القراءة/ }).first().click();
  const start = page.getByRole('button', { name: 'بدء الفحص' });
  await expect(start).toBeDisabled();
  await page.getByLabel('اسم الطفل أو لقبه').fill('سارة');
  for (const label of [/المكان هادئ/, /الصوت واضح/, /الطفل مرتاح ومستعد/, /موافقة ولي الأمر/]) {
    await page.getByLabel(label).check();
  }
  await start.click();
  for (const game of [
    'قارئ الكلمات', 'كلمات من كوكب آخر', 'قصة سامي', 'سباق الصور', 'سباق الحروف',
    'نوافذ القلعة', 'بيوت الحيوانات', 'ببغاء الحديقة', 'أصدقاء الفضاء', 'كلمات تتشابه', 'مختبر الأصوات',
    'الأذن الذهبية', 'عين الصقر', 'صندوق الحروف', 'الكاتب الصغير',
  ]) {
    await expect(page.getByText(game, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('أُنجزت ٠ من ١٥ مهام')).toBeVisible();
  await expect(page.getByRole('button', { name: 'النتيجة والتقرير' })).toBeDisabled();
  await page.getByRole('button', { name: 'البرنامج التدريبي' }).first().click();
  await expect(page.getByRole('heading', { name: /البرنامج التدريبي الموجّه/ }).first()).toBeVisible();
});

test('voice reading requires separate audio consent and never offers adult word scoring', async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installSchoolTestSession(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /فحص مؤشرات عسر القراءة/ }).first().click();
  await page.getByLabel('اسم الطفل أو لقبه').fill('سارة');
  await page.getByLabel('السنوات').selectOption('7');
  for (const label of [/المكان هادئ/, /الصوت واضح/, /الطفل مرتاح ومستعد/, /موافقة ولي الأمر/]) {
    await page.getByLabel(label).check();
  }
  // Audio consent is intentionally left unchecked.
  await page.getByRole('button', { name: 'بدء الفحص' }).click();

  await page.getByText('قصة سامي', { exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ابدأ تسجيل القراءة' })).toBeDisabled();
  await expect(page.getByText(/لم تُمنح موافقة منفصلة على تسجيل صوت الطفل/)).toBeVisible();
  await expect(page.getByRole('button', { name: /صحيح|خطأ/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'متابعة دون درجة' }).click();
  await expect(page.getByText('تم إنهاء المهمة دون درجة صوتية')).toBeVisible();
  await expect(page.getByText(/لن تُعامل الكلمات غير المحسومة كأخطاء/)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('dictation: letter tiles, delete, and a scored answer', async ({ page }) => {
  test.setTimeout(90_000);
  await installSchoolTestSession(page);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/');
  await page.getByRole('button', { name: /فحص مؤشرات عسر القراءة/ }).first().click();
  await page.getByLabel('اسم الطفل أو لقبه').fill('سارة');
  await page.getByLabel('السنوات').selectOption('7');
  for (const label of [/المكان هادئ/, /الصوت واضح/, /الطفل مرتاح ومستعد/, /موافقة ولي الأمر/]) await page.getByLabel(label).check();
  await page.getByRole('button', { name: 'بدء الفحص' }).click();
  await page.getByText('الكاتب الصغير', { exact: true }).click();
  await page.getByRole('button', { name: 'لنتدرّب أولًا' }).click();
  // Practice word «دار»: type it with one slip corrected.
  for (const letter of ['د', 'ا', 'ب']) await page.getByRole('button', { name: `حرف ${letter}`, exact: true }).click();
  await page.getByRole('button', { name: 'امسح حرفًا' }).click();
  await page.getByRole('button', { name: 'حرف ر', exact: true }).click();
  await expect(page.getByLabel('ما كُتب: دار')).toBeVisible();
  await page.getByRole('button', { name: 'تَمّ' }).click();
  await page.getByRole('button', { name: 'هيا بنا' }).click();
  // First scored word «باب».
  for (const letter of ['ب', 'ا', 'ب']) await page.getByRole('button', { name: `حرف ${letter}`, exact: true }).click();
  await page.getByRole('button', { name: 'تَمّ' }).click();
  await expect(page.getByLabel('لم يُكتب شيء بعد')).toBeVisible();
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
  await expect(page.getByText(/رُوجع ٠ من [٠-٩]{3}/)).toBeVisible();
  await page.getByRole('button', { name: 'صحيح' }).first().click();
  await expect(page.getByText(/رُوجع ١ من [٠-٩]{3}/)).toBeVisible();
});

test('training gym opens on the daily curriculum and switches to skill stations', async ({ page }) => {
  await installSchoolTestSession(page);
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/gym');

  await expect(page.getByRole('heading', { name: 'صالة التدريب', exact: true })).toBeVisible();
  const dailyTab = page.getByRole('tab', { name: /تمرين اليوم/ });
  await expect(dailyTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'نتعلّم المهارة خطوةً خطوة' })).toBeVisible();
  await expect(page.getByTestId('curriculum-answer-option')).toHaveCount(3);

  await page.getByRole('tab', { name: /ألعاب المهارات/ }).click();
  await expect(page.getByRole('tab', { name: /ألعاب المهارات/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /صائد الحروف/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
