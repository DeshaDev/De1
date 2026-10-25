import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeSoundex,
  encodeDoubleMetaphoneLite,
  encodeArabicPhoneticSkeleton,
  computeStandardLevenshtein,
  computeDyslexicoWeightedLevenshtein,
  analyzeTextWithDyslexico,
  evaluateOralReadingAlignment,
  toConservativeAutomatedOralReadingStatus,
  normalizeArabicDialectWord,
  ARABIC_DIALECT_PROFILES,
} from './dyslexiaEngines.ts';

test('Dyslexico Soundex, Double Metaphone, and Arabic Phonetic Skeleton match dyslexic spellings', () => {
  // "froot" and "fruit" share the exact same Soundex (F630) and Metaphone (FRT)
  assert.equal(encodeSoundex('froot'), encodeSoundex('fruit'));
  assert.equal(
    encodeDoubleMetaphoneLite('froot'),
    encodeDoubleMetaphoneLite('fruit')
  );

  // "fone" and "phone" share the exact same Metaphone (FN)
  assert.equal(
    encodeDoubleMetaphoneLite('fone'),
    encodeDoubleMetaphoneLite('phone')
  );

  // Arabic homophones (المنظار vs المنضار, المدرسة vs المدرسه) share the same phonetic skeleton
  assert.equal(
    encodeArabicPhoneticSkeleton('المنظار'),
    encodeArabicPhoneticSkeleton('المنضار')
  );
  assert.equal(
    encodeArabicPhoneticSkeleton('المدرسة'),
    encodeArabicPhoneticSkeleton('المدرسه')
  );
});

test('Dyslexico Weighted Levenshtein assigns near-zero cost to b/d reversals, transpositions, and phonetic pairs', () => {
  // Visual reversal: 'b' <-> 'd' in 'dird' vs 'bird'
  const bReversal = computeDyslexicoWeightedLevenshtein('dird', 'bird');
  assert.equal(bReversal.standardDistance, 1);
  assert.ok(bReversal.weightedDistance < 0.25);
  assert.ok(
    bReversal.detectedPatterns.some(
      (p) => p.type === 'visual_mirror_reversal'
    )
  );

  // Kinetic transposition: 'teh' vs 'the'
  const trans = computeDyslexicoWeightedLevenshtein('teh', 'the');
  assert.equal(trans.standardDistance, 2);
  assert.ok(trans.weightedDistance <= 0.25);

  // Phonetic vowel cluster: 'froot' vs 'fruit'
  const froot = computeDyslexicoWeightedLevenshtein('froot', 'fruit');
  assert.equal(froot.standardDistance, 2);
  assert.ok(froot.weightedDistance <= 0.25);

  // Full sentence analysis
  const analysis = analyzeTextWithDyslexico('teh froot المنضار');
  assert.equal(analysis[0].bestCorrection, 'the');
  assert.equal(analysis[1].bestCorrection, 'fruit');
  assert.equal(analysis[2].bestCorrection, 'المنظار');
});

test('Arabic dot-confusable graphemes are not mislabeled as literal mirror reversals', () => {
  const result = computeDyslexicoWeightedLevenshtein('ب', 'ت');
  assert.ok(result.detectedPatterns.some((pattern) => pattern.type === 'grapheme_confusion'));
  assert.ok(result.detectedPatterns.every((pattern) => pattern.type !== 'visual_mirror_reversal'));
  assert.match(result.detectedPatterns.find((pattern) => pattern.type === 'grapheme_confusion')?.labelAr ?? '', /موضع النقاط/);
});

test('unmatched ASR token is aligned as a substitution instead of a false omission', () => {
  const result = evaluateOralReadingAlignment(
    ['خَرَجَتْ', 'سَلْمَى', 'الْبَيْتُ'],
    'خرجت سلمى شجرة',
    10,
    0,
    'msa'
  );
  assert.equal(result.alignment.length, 3);
  assert.equal(result.alignment[2].targetWord, 'الْبَيْتُ');
  assert.equal(result.alignment[2].spokenWord, 'شجرة');
  assert.equal(result.alignment[2].status, 'phonetic_substitution');
  assert.equal(result.omittedWordsCount, 0);
  assert.equal(result.phoneticSubstitutionCount, 1);
});

test('ASR-only omissions/substitutions remain unconfirmed, not attributed to the child', () => {
  assert.equal(toConservativeAutomatedOralReadingStatus({
    targetWord: 'الحديقة', spokenWord: null, status: 'omitted', weightedDistance: 1,
  }), 'unconfirmed');
  assert.equal(toConservativeAutomatedOralReadingStatus({
    targetWord: 'الشجرة', spokenWord: 'شجرة', status: 'phonetic_substitution', weightedDistance: 1,
  }), 'unconfirmed');
  assert.equal(toConservativeAutomatedOralReadingStatus({
    targetWord: 'البيت', spokenWord: 'البيت', status: 'correct', weightedDistance: 0,
  }), 'correct');
  assert.equal(toConservativeAutomatedOralReadingStatus(undefined), 'unconfirmed');
});

test('Oral reading fluency alignment computes WCPM, phonetic substitutions, and understands Arabic dialects without false penalty', () => {
  const refWords = ['ذهب', 'الطالب', 'إلى', 'المدرسة', 'صباحاً'];
  const transcript = 'ذهب التالب إلى المدرسه';
  const res = evaluateOralReadingAlignment(refWords, transcript, 12, 1);

  assert.equal(res.totalWords, 5);
  assert.ok(res.wcpm > 0);
  assert.equal(res.omittedWordsCount, 1);
  assert.ok(res.phoneticSubstitutionCount >= 1);

  // Test Egyptian / Levantine / Gulf dialect variants: "دهب" is interdental dialectal variant for "ذهب"
  const normDhahab = normalizeArabicDialectWord('دهب');
  assert.equal(normDhahab.isDialectVariant, true);
  assert.equal(normDhahab.canonicalMsa, 'ذهب');

  const dialectRes = evaluateOralReadingAlignment(
    ['ذهب', 'الطالب', 'إلى', 'المدرسة'],
    'دهب الطالب إلى المدرسة',
    10,
    0
  );
  assert.equal(dialectRes.dialectVariantCount, 1);
  assert.equal(dialectRes.accuracyPercent, 100);
  assert.equal(ARABIC_DIALECT_PROFILES.length, 5);
});

test('Dyslexico 3-way Arabic linguistic classification strictly separates letter confusions, orthographic conventions, and valid dialect words (including proclitics)', async () => {
  const tokens = analyzeTextWithDyslexico(
    'قرأ التالب كتاب في المدرسه وشاف المنضار صوب الجبل',
    'gulf'
  );

  const byWord = new Map(tokens.map((t) => [t.originalWord, t]));

  // 1) "التالب" and "المنضار" -> phonological/visual letter confusion candidate
  const talib = byWord.get('التالب');
  assert.ok(talib);
  assert.equal(talib.variationCategory, 'phonological_or_visual_confusion');
  assert.equal(talib.requiresTeacherReview, true);
  assert.equal(talib.bestCorrection, 'الطالب');

  const mindhar = byWord.get('المنضار');
  assert.ok(mindhar);
  assert.equal(mindhar.variationCategory, 'phonological_or_visual_confusion');
  assert.equal(mindhar.requiresTeacherReview, true);
  assert.equal(mindhar.bestCorrection, 'المنظار');

  // 2) "المدرسه" -> common digital orthographic convention (ه vs ة), NOT a dyslexia candidate
  const madrasa = byWord.get('المدرسه');
  assert.ok(madrasa);
  assert.equal(madrasa.variationCategory, 'orthographic_convention');
  assert.equal(madrasa.requiresTeacherReview, false);
  assert.equal(madrasa.bestCorrection, 'المدرسة');

  // 3) "وشاف" (with proclitic و) and "صوب" -> valid Arabic dialect lexical usage, NOT an error and NOT a dyslexia candidate
  const washaf = byWord.get('وشاف');
  assert.ok(washaf);
  assert.equal(washaf.variationCategory, 'valid_dialect_lexical');
  assert.equal(washaf.isCorrect, true);
  assert.equal(washaf.requiresTeacherReview, false);
  assert.equal(washaf.bestCorrection, 'شاهد');

  const sawb = byWord.get('صوب');
  assert.ok(sawb);
  assert.equal(sawb.variationCategory, 'valid_dialect_lexical');
  assert.equal(sawb.isCorrect, true);
  assert.equal(sawb.requiresTeacherReview, false);
});

test('Oral reading alignment supports multi-target dialect synonyms, tanween pause forms, and systematic phonological shifts across unseen words', async () => {
  const targetPassage = [
    'خَرَجَتْ',
    'سَلْمَى',
    'صَبَاحاً',
    'وَشَاهَدَتْ',
    'الْقَمْحَ',
    'الذَّهَبِيَّ',
    'فِي',
    'الْقَرْيَةِ',
  ];
  // Student uses dialectal lexical verbs (راحت، وشافت), pause form without tanween (صباح),
  // and systematic Egyptian/Levantine phonological shifts on words not hardcoded in the dictionary (الأمح، الدهبي، الأرية)
  const spoken = 'راحت سلمى صباح وشافت الأمح الدهبي في الأرية';
  const res = evaluateOralReadingAlignment(targetPassage, spoken, 12, 0, 'egyptian');
  assert.equal(res.accuracyPercent, 100);
  assert.equal(res.phoneticSubstitutionCount, 0);
  assert.equal(res.omittedWordsCount, 0);
  assert.ok(res.dialectVariantCount >= 4);
});

test('Graded Arabic reading bank contains multiple passages for each grade 1–6, all >=50 words, across three diacritic levels', async () => {
  const { ARABIC_READING_PASSAGES } = await import('../data/seedData.ts');
  assert.equal(ARABIC_READING_PASSAGES.length, 12);

  const grades = new Set(ARABIC_READING_PASSAGES.map((p) => p.gradeLevel));
  assert.ok(grades.has(1), 'Must include Grade 1');
  assert.ok(grades.has(2), 'Must include Grade 2');
  assert.ok(grades.has(3), 'Must include Grade 3');
  assert.ok(grades.has(4), 'Must include Grade 4');
  assert.ok(grades.has(5), 'Must include Grade 5');
  assert.ok(grades.has(6), 'Must include Grade 6');
  for (let grade = 1; grade <= 6; grade += 1) assert.ok(ARABIC_READING_PASSAGES.filter((p) => p.gradeLevel === grade).length >= 2, `Grade ${grade} needs multiple passages`);

  const diacriticLevels = new Set(
    ARABIC_READING_PASSAGES.map((p) => p.diacriticLevel)
  );
  assert.ok(diacriticLevels.has('full'));
  assert.ok(diacriticLevels.has('partial'));
  assert.ok(diacriticLevels.has('minimal'));

  // Verify Grade 2 Cat passage uses clean water (مَاءٌ عَذْبٌ) and suitable food (وَطَعَامٌ مُنَاسِبٌ.) instead of cow's milk and bread
  const catPassage = ARABIC_READING_PASSAGES.find(
    (p) => p.id === 'passage-g2-garden'
  );
  assert.ok(catPassage);
  assert.ok(catPassage.words.includes('مَاءٌ'));
  assert.ok(catPassage.words.includes('عَذْبٌ'));
  assert.ok(catPassage.words.includes('وَطَعَامٌ'));
  assert.ok(!catPassage.words.includes('حَلِيبٌ'));
  assert.ok(!catPassage.words.includes('وَخُبْزٌ'));

  // Every passage declares its exact token count; content is expected to be at least 50 words.
  const actualWordCounts = ARABIC_READING_PASSAGES.map((p) => p.words.length);
  assert.deepEqual(actualWordCounts, [52, 53, 55, 57, 55, 58, 65, 50, 50, 50, 79, 78]);

  // Verify Grade 4 Oasis passage is partial diacritics (not over-vowelized)
  const oasis = ARABIC_READING_PASSAGES.find((p) => p.id === 'passage-g4-oasis');
  assert.ok(oasis);
  assert.equal(oasis.diacriticLevel, 'partial');

  // Verify editorial accuracy: تَفقَّدَ with shadda in G4 water passage & الألواحُ الشمسيةُ in G5 solar passage
  const waterPassage = ARABIC_READING_PASSAGES.find(
    (p) => p.id === 'passage-g4-partial-water'
  );
  assert.ok(waterPassage);
  assert.ok(waterPassage.words.includes('تَفقَّدَ'));

  const solarPassage = ARABIC_READING_PASSAGES.find(
    (p) => p.id === 'passage-g5-solar'
  );
  assert.ok(solarPassage);
  assert.ok(solarPassage.words.includes('الشمسيةُ'));

  const answerPositionCounts = [0, 0, 0];
  for (const passage of ARABIC_READING_PASSAGES) {
    assert.ok(
      passage.words.length >= 50,
      `Passage ${passage.id} has ${passage.words.length} words, expected >= 50`
    );
    assert.equal(passage.wordCount, passage.words.length);
    assert.equal(passage.comprehensionQuestions.length, 4);

    // Within each 4-question passage, all 3 option positions (0, 1, 2) must appear
    const passageIndices = new Set(
      passage.comprehensionQuestions.map((q) => q.correctIndex)
    );
    assert.equal(
      passageIndices.size,
      3,
      `Passage ${passage.id} must use all 3 answer positions (0, 1, 2)`
    );

    for (const q of passage.comprehensionQuestions) {
      assert.equal(q.options.length, 3);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 2);
      answerPositionCounts[q.correctIndex]++;
    }
  }

  // Across the expanded 48-question bank, rotate the correct answer position to reduce guessing cues.
  assert.equal(answerPositionCounts.reduce((sum, count) => sum + count, 0), 48);
  for (let pos = 0; pos < 3; pos++) {
    assert.ok(answerPositionCounts[pos] >= 13 && answerPositionCounts[pos] <= 19,
      `Option index ${pos} count is ${answerPositionCounts[pos]}/48 — distribution is too uneven`);
  }
});

test('analyzeTextWithDyslexico actively changes token classification based on selected Arabic dialect and sentence context', async () => {
  const sampleSentence = 'زار تلاميز المسيد في الأرية';

  // 1) In Egyptian dialect: "تلاميز" (ذ->ز) and "الأرية" (ق->أ) are valid Egyptian phonological shifts,
  // whereas Gulf-specific "المسيد" / "مسيد" (ج->ي) is NOT Egyptian
  const egyptianTokens = analyzeTextWithDyslexico(sampleSentence, 'egyptian');
  const egByWord = new Map(egyptianTokens.map((t) => [t.originalWord, t]));
  assert.equal(
    egByWord.get('تلاميز')?.variationCategory,
    'dialect_phonological_shift'
  );
  assert.equal(egByWord.get('تلاميز')?.requiresTeacherReview, false);
  assert.equal(
    egByWord.get('الأرية')?.variationCategory,
    'dialect_phonological_shift'
  );
  assert.equal(egByWord.get('الأرية')?.requiresTeacherReview, false);

  // 2) In Gulf dialect: "تلاميز" and "الأرية" are NOT Gulf phonological shifts, so they are flagged as confusions,
  // whereas "مسيد" (ج->ي) IS a valid Gulf phonological shift
  const gulfTokens = analyzeTextWithDyslexico('زار تلاميز مسيد في الأرية', 'gulf');
  const gulfByWord = new Map(gulfTokens.map((t) => [t.originalWord, t]));
  assert.equal(
    gulfByWord.get('تلاميز')?.variationCategory,
    'phonological_or_visual_confusion'
  );
  assert.equal(gulfByWord.get('تلاميز')?.requiresTeacherReview, true);
  assert.equal(
    gulfByWord.get('الأرية')?.variationCategory,
    'phonological_or_visual_confusion'
  );
  assert.equal(
    gulfByWord.get('مسيد')?.variationCategory,
    'dialect_phonological_shift'
  );
  assert.equal(gulfByWord.get('مسيد')?.requiresTeacherReview, false);

  // 3) In strict MSA mode ('msa'): neither Egyptian nor Gulf phonological shifts are exempted
  const msaTokens = analyzeTextWithDyslexico('زار تلاميز مسيد في الأرية', 'msa');
  const msaByWord = new Map(msaTokens.map((t) => [t.originalWord, t]));
  assert.equal(msaByWord.get('تلاميز')?.requiresTeacherReview, true);
  assert.equal(msaByWord.get('مسيد')?.requiresTeacherReview, true);
  assert.equal(msaByWord.get('الأرية')?.requiresTeacherReview, true);
});





