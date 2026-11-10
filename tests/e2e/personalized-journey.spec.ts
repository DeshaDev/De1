import { expect, test, type Page } from '@playwright/test';
import { PASSAGE_WORDS } from '../../src/cognitiveProfile/readingTasks';

test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

async function prepareFastAudioAndSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.route('**/audio/v1/manifest.json', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
}

function buildPassageAssessmentPayload(opts: {
  accuracyPercent: number;
  substituteSeenPairs: boolean;
}) {
  const words = PASSAGE_WORDS.map((word, idx) => {
    if (
      opts.substituteSeenPairs &&
      (word.includes('سَمَكَةً') || word.includes('سَاخِنًا') || word.includes('سَعِيدًا'))
    ) {
      return {
        word,
        errorType: 'Substitution' as const,
        accuracyScore: 35,
        spokenWord: word.replace('س', 'ص'),
      };
    }
    if (opts.accuracyPercent < 60 && idx % 2 === 0 && idx > 2 && idx < 32) {
      return {
        word,
        errorType: 'Substitution' as const,
        accuracyScore: 42,
        spokenWord: 'كلمة',
      };
    }
    return {
      word,
      errorType: 'None' as const,
      accuracyScore: 95,
      spokenWord: word,
    };
  });
  const correctCount = words.filter((w) => w.errorType === 'None').length;
  const subCount = words.length - correctCount;
  return {
    assessment: {
      taskId: 'oralReading',
      sourceModel: 'azure_pronunciation_assessment',
      assessmentComplete: true,
      assessmentReceipt: 'a'.repeat(64),
      transcript: words.map((w) => w.spokenWord).join(' '),
      durationSeconds: 32,
      wordAccuracyPercent: Math.round((correctCount / words.length) * 100),
      wordsCorrectPerMinute: 40,
      wordsPerMinute: 68,
      correctWordsCount: correctCount,
      substitutionsCount: subCount,
      omissionsCount: 0,
      insertionsCount: 0,
      words,
    },
  };
}

async function startBatteryWithAudioConsent(page: Page, childName: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /فحص مؤشرات عسر القراءة/ }).first().click();
  await page.getByLabel('اسم الطفل أو لقبه').fill(childName);
  await page.getByLabel('السنوات').selectOption('7');
  await page.getByLabel('لهجة الطفل في البيت').selectOption('egyptian');
  for (const label of [
    /المكان هادئ/,
    /الصوت واضح/,
    /الطفل مرتاح ومستعد/,
    /^موافقة ولي الأمر/,
    /موافقة منفصلة على تسجيل الصوت/,
  ]) {
    await page.getByLabel(label).check();
  }
  await page.getByRole('button', { name: 'بدء الفحص' }).click();
}

async function completeOralReadingTask(page: Page) {
  await page.getByText('قصة سامي', { exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ تسجيل القراءة' }).click();
  await expect(page.getByText(/التسجيل الصوتي جارٍ/)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'انتهيت من القراءة — حلّل التسجيل' }).click();
  const continueBtn = page.getByRole('button', { name: /متابعة النتيجة والانتقال للمهمة التالية/ });
  await expect(continueBtn).toBeVisible({ timeout: 15_000 });
  await continueBtn.click();
  await page.getByRole('button', { name: 'العودة إلى خريطة الألعاب' }).click();
}

async function completeFirstSessionExercises(page: Page) {
  await page.getByRole('button', { name: 'اعتماد الخطة وبدء البرنامج' }).click();
  await page.getByRole('button', { name: /ابدأ درس اليوم والشرح مباشرة/ }).click();

  const seenHeaders: string[] = [];
  const summaryDone = page.getByText('انتهت جلسة اليوم!', { exact: true });
  for (let step = 0; step < 1500; step += 1) {
    if (await summaryDone.isVisible().catch(() => false)) break;

    const headerLocator = page.locator('p').filter({ hasText: 'وقت التعلّم:' }).first();
    if ((await headerLocator.count()) > 0) {
      const text = (await headerLocator.innerText({ timeout: 250 }).catch(() => '')).trim();
      if (text && !seenHeaders.includes(text)) seenHeaders.push(text);
    }

    const nextLessonBtn = page.getByRole('button', { name: 'التالي', exact: true });
    if (await nextLessonBtn.isVisible().catch(() => false)) {
      await nextLessonBtn.click();
      continue;
    }

    const trainAfterLessonBtn = page.getByRole('button', { name: /هيا نتدرّب/ });
    if (await trainAfterLessonBtn.isVisible().catch(() => false)) {
      await trainAfterLessonBtn.click();
      continue;
    }

    const skillIntroStartBtn = page.getByRole('button', { name: 'ابدأ', exact: true });
    if (await skillIntroStartBtn.isVisible().catch(() => false)) {
      await skillIntroStartBtn.click();
      continue;
    }

    const retryBtn = page.getByRole('button', { name: /حاول مرة أخرى/ });
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
      continue;
    }

    const nextSkillBtn = page.getByRole('button', { name: /^(المهارة التالية|إنهاء الجلسة)$/ });
    if (await nextSkillBtn.isVisible().catch(() => false)) {
      await nextSkillBtn.click();
      continue;
    }

    const choiceOption = page.locator('button[class*="min-h-[120px]"]').first();
    if (await choiceOption.isVisible().catch(() => false)) {
      if (await choiceOption.isEnabled().catch(() => false)) {
        await choiceOption.click();
        continue;
      }
    }

    await page.waitForTimeout(100);
  }

  await expect(summaryDone).toBeVisible({ timeout: 20_000 });
  const summaryRows = await page.locator('ul li').allInnerTexts();
  return { seenHeaders, summaryRows };
}

test.describe('end-to-end personalized screening to training journey', () => {
  test('two children with different screening results receive distinct plans, start levels, doses, and Session 1 training exercises', async ({
    page,
  }) => {
    test.setTimeout(240_000);

    // -------------------- Child 1: سلمى --------------------
    // Sound confusions (س/ص) on قصة سامي (92% -> discrimination/letterSound Level 2) + 0% discontinued كلمات تتشابه (rhyme -> Level 1)
    await prepareFastAudioAndSession(page);
    let capturedWavBytes = 0;
    let capturedConsent = false;
    await page.route('**/api/ai/cognitive-audio-assessment', async (route) => {
      const reqBody = JSON.parse(route.request().postData() || '{}') as {
        audioWavBase64?: string;
        guardianAudioConsentGiven?: boolean;
      };
      capturedWavBytes = typeof reqBody.audioWavBase64 === 'string' ? reqBody.audioWavBase64.length : 0;
      capturedConsent = reqBody.guardianAudioConsentGiven === true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPassageAssessmentPayload({ accuracyPercent: 92, substituteSeenPairs: true })),
      });
    });

    await startBatteryWithAudioConsent(page, 'سلمى');
    await completeOralReadingTask(page);
    expect(capturedWavBytes).toBeGreaterThan(1000);
    expect(capturedConsent).toBe(true);

    // Complete كلمات تتشابه (rhyme): 2 practice + 4 wrong clicks -> discontinued 0% -> Level 1 (larger dose)
    await page.getByText('كلمات تتشابه', { exact: true }).click();
    await page.getByRole('button', { name: 'لنتدرّب أولًا' }).click();
    const optBtn = page.locator('button[class*="min-h-[120px]"]').first();
    for (let pIdx = 0; pIdx < 2; pIdx += 1) {
      await expect(optBtn).toBeEnabled({ timeout: 15_000 });
      await optBtn.click();
    }
    await page.getByRole('button', { name: 'هيا بنا' }).click();

    const child1RhymeWrongClicks = ['كَلْب', 'فِيل', 'بَيْت', 'أَرْنَب'];
    for (const wordLabel of child1RhymeWrongClicks) {
      const targetOption = page.locator('button[class*="min-h-[120px]"]').filter({
        has: page.locator(`img[alt="${wordLabel}"]`),
      });
      await expect(targetOption).toBeEnabled({ timeout: 15_000 });
      await targetOption.click();
    }
    await expect(page.locator('[data-mascot-moment="proud"]')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'العودة إلى خريطة الألعاب' }).click();

    // Open Report -> Training Plan Proposal
    await page.getByRole('button', { name: 'النتيجة والتقرير' }).click();
    await page.getByRole('button', { name: 'الانتقال إلى البرنامج التدريبي' }).click();
    await expect(page.getByRole('heading', { name: 'الخطة المقترحة من نتائج الفحص' })).toBeVisible();

    await expect(page.getByText(/أصوات س\/ص/)).toBeVisible();
    await expect(page.getByText('التمييز السمعي', { exact: true })).toBeVisible();
    await expect(page.getByText('القافية', { exact: true })).toBeVisible();
    await expect(page.getByText(/مستوى البداية: المستوى ٢/).first()).toBeVisible();
    await expect(page.getByText(/مستوى البداية: المستوى ١/).first()).toBeVisible();
    await expect(page.getByText(/جرعة الجلسة: ١٠ تمارين/)).toBeVisible();
    await expect(page.getByText(/جرعة الجلسة: ٧ تمارين/).first()).toBeVisible();

    const child1Result = await completeFirstSessionExercises(page);
    expect(child1Result.seenHeaders.some((h) => h.includes('التمييز السمعي') && h.includes('المستوى ٢'))).toBe(true);
    expect(child1Result.seenHeaders.some((h) => h.includes('القافية') && h.includes('المستوى ١'))).toBe(true);
    const rhymeSummary = child1Result.summaryRows.find((r) => r.includes('القافية'));
    const discSummary = child1Result.summaryRows.find((r) => r.includes('التمييز السمعي'));
    const letterSummary = child1Result.summaryRows.find((r) => r.includes('ربط الحرف بصوته'));
    expect(rhymeSummary).toBeTruthy();
    expect(discSummary).toBeTruthy();
    expect(letterSummary).toBeTruthy();

    // -------------------- Child 2: عمر --------------------
    // Accurate قصة سامي (100%) + 0% discontinued on صندوق الحروف (letterSound -> Level 1 only)
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/audio/v1/manifest.json', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    await page.evaluate(() => window.localStorage.clear());
    await page.route('**/api/ai/cognitive-audio-assessment', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildPassageAssessmentPayload({ accuracyPercent: 100, substituteSeenPairs: false })),
      });
    });

    await startBatteryWithAudioConsent(page, 'عمر');
    await completeOralReadingTask(page);

    await page.getByText('صندوق الحروف', { exact: true }).click();
    await page.getByRole('button', { name: 'لنتدرّب أولًا' }).click();
    await expect(optBtn).toBeEnabled({ timeout: 15_000 });
    await optBtn.click();
    await page.getByRole('button', { name: 'هيا بنا' }).click();

    for (const wrongLetter of ['ت', 'ش', 'ذ', 'ق', 'خ']) {
      const targetOption = page.locator('button[class*="min-h-[120px]"]').filter({
        has: page.locator(`span[aria-label="${wrongLetter}"]`),
      });
      await expect(targetOption).toBeEnabled({ timeout: 15_000 });
      await targetOption.click();
    }
    await expect(page.locator('[data-mascot-moment="proud"]')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'العودة إلى خريطة الألعاب' }).click();

    await page.getByRole('button', { name: 'النتيجة والتقرير' }).click();
    await page.getByRole('button', { name: 'الانتقال إلى البرنامج التدريبي' }).click();
    await expect(page.getByRole('heading', { name: 'الخطة المقترحة من نتائج الفحص' })).toBeVisible();

    await expect(page.getByText('ربط الحرف بصوته', { exact: true })).toBeVisible();
    await expect(page.getByText('التمييز السمعي', { exact: true })).toHaveCount(0);
    await expect(page.getByText('القافية', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/أصوات س\/ص/)).toHaveCount(0);

    const child2Result = await completeFirstSessionExercises(page);
    expect(child2Result.seenHeaders.some((h) => h.includes('ربط الحرف بصوته') && h.includes('المستوى ١'))).toBe(true);
    expect(child2Result.seenHeaders.some((h) => h.includes('التمييز السمعي') || h.includes('القافية'))).toBe(false);
    expect(child2Result.summaryRows.some((r) => r.includes('ربط الحرف بصوته'))).toBe(true);
  });
});
