/**
 * Visible-text and layout audit across every page a visitor can reach.
 * Checks what a parent, teacher or child actually sees:
 *  - no Western digits or stray English words in the Arabic interface,
 *  - no glued or doubled words («لـال», «في في»),
 *  - no sideways scrolling on a phone,
 *  - no runtime errors.
 */
import { test, expect, type Page } from '@playwright/test';

/** Latin tokens that are allowed: brand/vendor/standard names and contact addresses. */
const ALLOWED_LATIN = new Set([
  'PDF', 'NCSA', 'Azure', 'Microsoft', 'Speech', 'Google', 'Gemini', 'AES-256-GCM', 'HTTPS', 'TLS', 'IP', 'Render',
  'Baseera', 'EdTech', 'AA', 'Aa', 'Twemoji', 'CC', 'BY',
]);
const isContact = (t: string) => /@|\.(com|org|net|qa|sa)\b|^https?:/i.test(t);

interface Finding { page: string; kind: string; sample: string }

async function audit(page: Page, name: string, findings: Finding[]) {
  await page.waitForTimeout(350);
  const { text, overflow } = await page.evaluate(() => ({
    text: document.body.innerText,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const latinWords = (line.match(/[A-Za-z][A-Za-z0-9@._\-]*/g) ?? []).map((w) => w.replace(/[.,]+$/, '')).filter((w) => !ALLOWED_LATIN.has(w) && !isContact(w));
    if (latinWords.length) findings.push({ page: name, kind: 'english', sample: `${latinWords.join(' ')} ⟵ ${line.slice(0, 90)}` });
    const withoutContacts = line.replace(/\S*(@|\.com|https?:)\S*/g, '').replace(/AES-256-GCM/g, '');
    if (/[0-9]/.test(withoutContacts)) findings.push({ page: name, kind: 'western-digits', sample: line.slice(0, 110) });
    if (/لـال|لـ\s/.test(line)) findings.push({ page: name, kind: 'glued-preposition', sample: line.slice(0, 110) });
    const doubled = line.match(/(^|\s)([ء-ي]{2,})\s+\2(\s|$)/);
    if (doubled) findings.push({ page: name, kind: 'doubled-word', sample: line.slice(0, 110) });
  }
  if (overflow > 2) findings.push({ page: name, kind: 'horizontal-overflow', sample: `${overflow}px` });
}

const nav = async (page: Page, label: RegExp, mobile: boolean) => {
  if (mobile) await page.locator('.baseera-mobile-nav').getByText(label).click();
  else await page.locator('.baseera-topbar').getByRole('button', { name: label }).first().click();
};
const footer = (page: Page, label: string) => page.locator('.baseera-footer').getByRole('button', { name: label, exact: true }).click();

for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`content audit (${device})`, async ({ page }) => {
    test.setTimeout(120_000);
    const mobile = device === 'phone';
    await page.setViewportSize(viewport);
    const findings: Finding[] = [];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => window.localStorage.clear());

    await page.goto('/');
    await audit(page, 'home', findings);

    await page.getByRole('button', { name: /شاهد نموذج التقرير/ }).first().click();
    await audit(page, 'sample-report', findings);
    await page.goto('/');

    await nav(page, mobile ? /^الفحص$/ : /الفحص الشامل/, mobile);
    await audit(page, 'battery-setup', findings);
    await page.getByLabel('اسم الطفل أو لقبه').fill('سارة');
    for (const label of [/المكان هادئ/, /الصوت واضح/, /الطفل مرتاح ومستعد/, /موافقة ولي الأمر/]) await page.getByLabel(label).check();
    await page.getByRole('button', { name: 'بدء الفحص' }).click();
    await audit(page, 'battery-map', findings);
    await page.getByText('نوافذ القلعة', { exact: true }).click();
    await audit(page, 'battery-first-game', findings);
    await page.goto('/');

    await nav(page, mobile ? /^البرنامج$/ : /البرنامج التدريبي/, mobile);
    await audit(page, 'training-program', findings);

    await nav(page, mobile ? /^التدريب$/ : /صالة التدريب/, mobile);
    await audit(page, 'gym-today', findings);
    await page.getByRole('tab', { name: /ألعاب المهارات/ }).click();
    for (const station of ['صائد الحروف', 'تركيب المقاطع', 'قصص الأبطال', 'تحدي الدقائق الخمس', 'طلاقة القراءة']) {
      await page.getByRole('button', { name: new RegExp(station) }).first().click();
      await audit(page, `gym-${station}`, findings);
    }

    await nav(page, mobile ? /^القارئ$/ : /القارئ الميسّر/, mobile);
    await audit(page, 'reader-pick', findings);
    await page.getByRole('button', { name: /ابدأ القراءة/ }).click();
    await audit(page, 'reader-session', findings);
    // Walk one sentence to the comprehension questions and the summary.
    for (let guard = 0; guard < 400; guard++) {
      const done = page.getByRole('button', { name: /اختر نصًّا آخر/ });
      if (await done.isVisible().catch(() => false)) break;
      for (const name of [/أنا جاهز/, /الكلمة التالية/, /أنهيت الجملة/, /^قرأتها/, /الجملة التالية|إلى أسئلة الفهم/, /^التالي/]) {
        const btn = page.getByRole('button', { name }).first();
        if (await btn.isVisible().catch(() => false)) { await btn.click(); break; }
      }
      const option = page.locator('section .grid button').first();
      if (await page.getByRole('button', { name: /استمع إلى الكلمة/ }).isVisible().catch(() => false) && await option.isVisible()) await option.click();
      const qOption = page.locator('.bz-card .grid > button').first();
      if (await page.getByText(/سؤال فهم/).isVisible().catch(() => false) && await qOption.isVisible()) await qOption.click();
    }
    await audit(page, 'reader-summary', findings);
    await page.getByRole('button', { name: /اختر نصًّا آخر/ }).click();

    for (const [name, label] of [
      ['dashboard', 'لوحة المتابعة والتقارير'],
      ['oral-reading', 'فحص القراءة الجهرية'],
      ['rapid-naming', 'التسمية السريعة'],
      ['privacy', 'سياسة الخصوصية'],
      ['terms', 'شروط الاستخدام'],
    ] as const) {
      await page.goto('/');
      await footer(page, label);
      await audit(page, name, findings);
      if (name === 'dashboard') {
        await page.getByRole('tab', { name: /تقرير الطالب/ }).click();
        await audit(page, 'dashboard-report', findings);
      }
      if (name === 'oral-reading') {
        await page.getByRole('button', { name: /اختيار/ }).first().click();
        await audit(page, 'oral-reading-ready', findings);
      }
      if (name === 'rapid-naming') {
        for (const tab of ['التسمية السريعة', 'الكلمات غير الحقيقية', 'الوعي الصوتي', 'الملخص']) {
          await page.getByRole('tab', { name: new RegExp(tab) }).first().click();
          await audit(page, `rapid-naming-${tab}`, findings);
        }
      }
    }

    if (process.env.AUDIT_REPORT) console.log(JSON.stringify(findings, null, 1));
    expect(errors).toEqual([]);
    expect(findings).toEqual([]);
  });
}
