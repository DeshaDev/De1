import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOculomotorEvents,
  runOculomotorHeuristicAnalysis,
  encodeSoundex,
  encodeDoubleMetaphoneLite,
  encodeArabicPhoneticSkeleton,
  computeStandardLevenshtein,
  computeDyslexicoWeightedLevenshtein,
  analyzeTextWithDyslexico,
  computeIRT2PLProbability,
  computeIRTFisherInformation,
  estimateIRTAbilityEAP,
  selectNextAdaptiveIRTItem,
  CLINICAL_IRT_ITEM_BANK,
  evaluateOralReadingAlignment,
  normalizeArabicDialectWord,
  ARABIC_DIALECT_PROFILES,
  type RawGazeSample,
} from './dyslexiaEngines.ts';

test('eye-tracking heuristic PyGaze I-DT detector extracts fixations and regressive saccades accurately', () => {
  // Simulate an RTL reading trace:
  // Fixation 1 at x=700 (word 0, 0..260ms)
  // Forward saccade to x=550 (word 1, 280..620ms)
  // Regressive saccade back to x=695 (word 0, 640..1080ms)
  const samples: RawGazeSample[] = [
    { x: 700, y: 200, timestampMs: 0, wordIndex: 0 },
    { x: 703, y: 202, timestampMs: 90, wordIndex: 0 },
    { x: 698, y: 199, timestampMs: 180, wordIndex: 0 },
    { x: 701, y: 201, timestampMs: 260, wordIndex: 0 },
    // Saccade jump left to word 1
    { x: 550, y: 202, timestampMs: 290, wordIndex: 1 },
    { x: 554, y: 200, timestampMs: 410, wordIndex: 1 },
    { x: 548, y: 203, timestampMs: 530, wordIndex: 1 },
    { x: 551, y: 201, timestampMs: 630, wordIndex: 1 },
    // Regressive jump right back to word 0
    { x: 695, y: 200, timestampMs: 660, wordIndex: 0 },
    { x: 699, y: 202, timestampMs: 820, wordIndex: 0 },
    { x: 696, y: 198, timestampMs: 960, wordIndex: 0 },
    { x: 697, y: 201, timestampMs: 1120, wordIndex: 0 },
  ];

  const { fixations, saccades } = detectOculomotorEvents(samples, {
    minFixationDurationMs: 120,
    maxDispersionPx: 30,
    readingDirection: 'rtl',
  });

  assert.equal(fixations.length, 3);
  assert.equal(saccades.length, 2);
  assert.equal(saccades[0].direction, 'forward');
  assert.equal(saccades[1].direction, 'regressive');

  const mlResult = runOculomotorHeuristicAnalysis(samples, 5, {
    readingDirection: 'rtl',
  });
  assert.equal(mlResult.ruleVotes.length, 5);
  assert.ok(mlResult.heuristicRiskScore >= 40);
  assert.equal(mlResult.features.regressiveSaccadeCount, 1);
});

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

test('Marker/Parallel Learning 2PL IRT engine updates theta, SE, and selects maximum Fisher Information item', () => {
  const pMid = computeIRT2PLProbability(0, 1.5, 0);
  assert.ok(Math.abs(pMid - 0.5) < 1e-6);

  const infoPeak = computeIRTFisherInformation(0, 2.0, 0);
  const infoOff = computeIRTFisherInformation(2.0, 2.0, 0);
  assert.ok(infoPeak > infoOff);

  // Correct responses increase theta; incorrect responses decrease theta
  const highEst = estimateIRTAbilityEAP([
    { discriminationA: 1.8, difficultyB: 0.0, correct: true },
    { discriminationA: 2.0, difficultyB: 0.8, correct: true },
  ]);
  const lowEst = estimateIRTAbilityEAP([
    { discriminationA: 1.8, difficultyB: 0.0, correct: false },
    { discriminationA: 1.5, difficultyB: -1.0, correct: false },
  ]);

  assert.ok(highEst.theta > 0.4);
  assert.ok(lowEst.theta < -0.4);
  assert.ok(highEst.standardError < 1.0);

  const nextSelection = selectNextAdaptiveIRTItem(
    CLINICAL_IRT_ITEM_BANK,
    ['irt-1'],
    0.6
  );
  assert.ok(nextSelection.nextItem !== null);
  assert.notEqual(nextSelection.nextItem?.id, 'irt-1');
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
  assert.equal(talib.isDyslexiaScreeningCandidate, true);
  assert.equal(talib.bestCorrection, 'الطالب');

  const mindhar = byWord.get('المنضار');
  assert.ok(mindhar);
  assert.equal(mindhar.variationCategory, 'phonological_or_visual_confusion');
  assert.equal(mindhar.isDyslexiaScreeningCandidate, true);
  assert.equal(mindhar.bestCorrection, 'المنظار');

  // 2) "المدرسه" -> common digital orthographic convention (ه vs ة), NOT a dyslexia candidate
  const madrasa = byWord.get('المدرسه');
  assert.ok(madrasa);
  assert.equal(madrasa.variationCategory, 'orthographic_convention');
  assert.equal(madrasa.isDyslexiaScreeningCandidate, false);
  assert.equal(madrasa.bestCorrection, 'المدرسة');

  // 3) "وشاف" (with proclitic و) and "صوب" -> valid Arabic dialect lexical usage, NOT an error and NOT a dyslexia candidate
  const washaf = byWord.get('وشاف');
  assert.ok(washaf);
  assert.equal(washaf.variationCategory, 'valid_dialect_lexical');
  assert.equal(washaf.isCorrect, true);
  assert.equal(washaf.isDyslexiaScreeningCandidate, false);
  assert.equal(washaf.bestCorrection, 'شاهد');

  const sawb = byWord.get('صوب');
  assert.ok(sawb);
  assert.equal(sawb.variationCategory, 'valid_dialect_lexical');
  assert.equal(sawb.isCorrect, true);
  assert.equal(sawb.isDyslexiaScreeningCandidate, false);
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

test('Graded Arabic reading bank provides 7 passages covering all Grades 2, 3, 4, 5, and 6 with >=50 words each and 3 diacritic levels', async () => {
  const { ARABIC_READING_PASSAGES } = await import('../data/seedData.ts');
  assert.equal(ARABIC_READING_PASSAGES.length, 7);

  const grades = new Set(ARABIC_READING_PASSAGES.map((p) => p.gradeLevel));
  assert.ok(grades.has(2), 'Must include Grade 2');
  assert.ok(grades.has(3), 'Must include Grade 3');
  assert.ok(grades.has(4), 'Must include Grade 4');
  assert.ok(grades.has(5), 'Must include Grade 5');
  assert.ok(grades.has(6), 'Must include Grade 6');

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

  // Verify exact word counts match README documentation (52, 53, 55, 57, 55, 58, 65; range 52-65)
  const actualWordCounts = ARABIC_READING_PASSAGES.map((p) => p.words.length);
  assert.deepEqual(actualWordCounts, [52, 53, 55, 57, 55, 58, 65]);

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

  // Across all 28 questions, each option position (A=0, B=1, C=2) must be balanced (8 to 11 each; here 9, 10, 9)
  assert.equal(
    answerPositionCounts[0] + answerPositionCounts[1] + answerPositionCounts[2],
    28
  );
  for (let pos = 0; pos < 3; pos++) {
    assert.ok(
      answerPositionCounts[pos] >= 8 && answerPositionCounts[pos] <= 11,
      `Option index ${pos} count is ${answerPositionCounts[pos]}/28 — must be balanced between 8 and 11`
    );
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
  assert.equal(egByWord.get('تلاميز')?.isDyslexiaScreeningCandidate, false);
  assert.equal(
    egByWord.get('الأرية')?.variationCategory,
    'dialect_phonological_shift'
  );
  assert.equal(egByWord.get('الأرية')?.isDyslexiaScreeningCandidate, false);

  // 2) In Gulf dialect: "تلاميز" and "الأرية" are NOT Gulf phonological shifts, so they are flagged as confusions,
  // whereas "مسيد" (ج->ي) IS a valid Gulf phonological shift
  const gulfTokens = analyzeTextWithDyslexico('زار تلاميز مسيد في الأرية', 'gulf');
  const gulfByWord = new Map(gulfTokens.map((t) => [t.originalWord, t]));
  assert.equal(
    gulfByWord.get('تلاميز')?.variationCategory,
    'phonological_or_visual_confusion'
  );
  assert.equal(gulfByWord.get('تلاميز')?.isDyslexiaScreeningCandidate, true);
  assert.equal(
    gulfByWord.get('الأرية')?.variationCategory,
    'phonological_or_visual_confusion'
  );
  assert.equal(
    gulfByWord.get('مسيد')?.variationCategory,
    'dialect_phonological_shift'
  );
  assert.equal(gulfByWord.get('مسيد')?.isDyslexiaScreeningCandidate, false);

  // 3) In strict MSA mode ('msa'): neither Egyptian nor Gulf phonological shifts are exempted
  const msaTokens = analyzeTextWithDyslexico('زار تلاميز مسيد في الأرية', 'msa');
  const msaByWord = new Map(msaTokens.map((t) => [t.originalWord, t]));
  assert.equal(msaByWord.get('تلاميز')?.isDyslexiaScreeningCandidate, true);
  assert.equal(msaByWord.get('مسيد')?.isDyslexiaScreeningCandidate, true);
  assert.equal(msaByWord.get('الأرية')?.isDyslexiaScreeningCandidate, true);
});





