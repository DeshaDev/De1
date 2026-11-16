import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFluencyPassage, getStructuredLiteracyStations } from './structuredLiteracyStations';

describe('age-appropriate structured literacy practice stations', () => {
  it('keeps early-years children in listening comprehension and pre-reading support', () => {
    for (const age of [4, 5]) {
      const stations = getStructuredLiteracyStations(age);
      const ids = stations.map((station) => station.id);
      assert.deepEqual(ids, ['comprehension']);
      assert.match(stations[0].titleAr, /المسموع/);
      assert.ok(stations[0].questions.length >= 2);
    }
  });

  it('adds decoding, spelling and unscored fluency practice after reading instruction begins', () => {
    const stations = getStructuredLiteracyStations(6);
    const ids = stations.map((station) => station.id);
    assert.ok(ids.includes('decoding'));
    assert.ok(ids.includes('spelling'));
    assert.ok(ids.includes('fluency'));
    assert.ok(ids.includes('comprehension'));
    assert.ok(!ids.includes('morphology'));
  });

  it('adds introductory morphology only for the oldest children in the product age range', () => {
    const stations = getStructuredLiteracyStations(7);
    assert.ok(stations.some((station) => station.id === 'morphology'));
    assert.equal(getStructuredLiteracyStations(8).some((station) => station.id === 'morphology'), true);
  });

  it('keeps the early-years spoken worked example consistent with the displayed answer', () => {
    const station = getStructuredLiteracyStations(4).find((entry) => entry.id === 'comprehension');
    assert.ok(station);
    assert.match(station.modelAr, /نجيب: في الخزانة/);
    assert.match(station.modelAudioAr, /نُجِيبُ: فِي الْخِزَانَةِ/);
    assert.doesNotMatch(station.modelAudioAr, /تَحْتَ الْخِزَانَةِ/);
  });

  it('provides explicit teaching and a worked example before every practice station', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        assert.ok(station.teachAr.length >= 30, `${station.id}: missing explicit teaching`);
        assert.ok(station.modelAr.length >= 30, `${station.id}: missing worked example`);
        assert.ok(station.ageNoteAr.length > 0);
      }
    }
  });

  it('keeps speech narration separate and fully vowelled for Arabic speech synthesis', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        assert.ok(station.teachAudioAr.length >= 30, `${station.id}: missing vowelled teaching narration`);
        assert.ok(station.modelAudioAr.length >= 30, `${station.id}: missing vowelled model narration`);
        assert.match(station.teachAudioAr, /[ً-ْ]/, `${station.id}: teaching audio needs Arabic vowel marks`);
        assert.match(station.modelAudioAr, /[ً-ْ]/, `${station.id}: model audio needs Arabic vowel marks`);
      }
    }
  });

  it('provides a full bank of at least twenty items per level for every age-appropriate reading domain', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        if (station.questions.length === 0) continue;
        const ids = station.questions.map((question) => question.id);
        assert.equal(new Set(ids).size, ids.length, `${station.id}: duplicate question ID`);
        for (const level of [1, 2, 3] as const) {
          const items = station.questions.filter((question) => (question.level ?? 1) === level);
          assert.ok(items.length >= 20, `${station.id}/age ${age}/L${level}: expected at least twenty distinct items, got ${items.length}`);
        }
        assert.ok(station.questions.length >= 60, `${station.id}: expected at least sixty questions across levels`);
      }
    }
  });

  it('keeps different items distinct by their instruction, spoken content, options and answer', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        const signatures = station.questions.map((question) => [
          question.level ?? 1,
          question.promptAr,
          question.audio.join('|'),
          question.options.map((option) => `${option.id}:${option.labelAr}`).sort().join('|'),
          question.correctId,
        ].join('::'));
        assert.equal(new Set(signatures).size, signatures.length, `${station.id}: duplicate item content`);
      }
    }
  });

  it('does not display story text as a reading prompt to children under six', () => {
    const station = getStructuredLiteracyStations(4).find((entry) => entry.id === 'comprehension');
    assert.ok(station);
    const instruction = 'اِسْتَمِعْ إِلَى الْجُمْلَةِ، ثُمَّ أَجِبْ عَنِ السُّؤَالِ.';
    assert.ok(station.questions.length >= 60);
    for (const question of station.questions) assert.equal(question.promptAr, instruction, question.id);
  });

  it('includes at least five productive spelling tasks at every level', () => {
    const spelling = getStructuredLiteracyStations(6).find((station) => station.id === 'spelling');
    assert.ok(spelling);
    for (const level of [1, 2, 3] as const) {
      const tasks = spelling.questions.filter((question) => question.level === level && question.responseMode === 'text');
      assert.ok(tasks.length >= 5, `L${level}: expected five direct writing tasks, got ${tasks.length}`);
    }
  });

  it('gives every multiple-choice question unique options and exactly one correct answer', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        for (const question of station.questions) {
          if (question.responseMode === 'text') {
            assert.equal(station.id, 'spelling');
            assert.equal(question.options.length, 0);
            assert.ok(question.correctId.length > 1);
          } else {
            const ids = question.options.map((option) => option.id);
            assert.ok(ids.length >= 2, `${station.id}/${question.id}: too few options`);
            assert.equal(new Set(ids).size, ids.length, `${station.id}/${question.id}: duplicate option`);
            assert.equal(ids.filter((id) => id === question.correctId).length, 1, `${station.id}/${question.id}: answer is missing or ambiguous`);
          }
          assert.ok(question.explanationAr.length >= 15);
          assert.ok(question.explanationAudio.length > 0);
        }
      }
    }
  });

  it('includes at least one productive spelling task rather than relying only on recognition', () => {
    const spelling = getStructuredLiteracyStations(6).find((station) => station.id === 'spelling');
    assert.ok(spelling);
    assert.ok(spelling.questions.some((question) => question.responseMode === 'text'));
  });

  it('keeps every spoken practice prompt and explanation vowelled for Arabic speech', () => {
    for (const age of [4, 5, 6, 7, 8]) {
      for (const station of getStructuredLiteracyStations(age)) {
        for (const question of station.questions) {
          for (const phrase of [...question.audio, ...question.explanationAudio]) {
            if (/[ء-ي]{2,}/.test(phrase)) {
              assert.match(phrase, /[ً-ْ]/, `${station.id}/${question.id}: unvowelled spoken phrase: ${phrase}`);
            }
          }
        }
      }
    }
  });

  it('keeps revised picture clues and inference prompts identical across visible and spoken feedback', () => {
    const find = (age: number, stationId: string, questionId: string) =>
      getStructuredLiteracyStations(age)
        .find((station) => station.id === stationId)!
        .questions.find((question) => question.id === questionId)!;

    const fan = find(8, 'decoding', 'decode-fan');
    assert.ok(fan);
    assert.equal(fan.correctId, 'fan');
    assert.ok(fan.options.some((option) => option.id === fan.correctId));
    assert.equal(fan.explanationAudio[0], fan.explanationAr);
    assert.match(fan.explanationAr, /الْفَتْحَةِ عَلَى الْوَاوِ/);

    for (const [age, stationId] of [[4, 'comprehension'], [8, 'comprehension']] as const) {
      const bellId = age < 6 ? 'listen-bell-line' : 'read-bell-line';
      const bell = find(age, stationId, bellId);
      assert.ok(bell);
      assert.match(bell.audio[0], /جَرَسَ الِانْصِرَافِ/);
      assert.equal(bell.explanationAudio[0], bell.explanationAr);
    }

    for (const [age, questionId] of [[4, 'listen-plant-droop'], [8, 'read-plant-droop']] as const) {
      const station = find(age, 'comprehension', questionId);
      assert.equal(station.correctId, 'water');
      assert.ok(station.options.some((option) => option.id === station.correctId));
      assert.equal(station.explanationAudio[0], station.explanationAr);
    }
  });

  it('progresses morphology from word-family meaning to active and passive participles', () => {
    const station = getStructuredLiteracyStations(7).find((entry) => entry.id === 'morphology');
    assert.ok(station);
    const byId = (id: string) => station.questions.find((question) => question.id === id)!;

    assert.equal(byId('morphology-farm').level, 1);
    assert.equal(byId('morphology-farm').correctId, 'زراعة');
    assert.equal(byId('morphology-remember').correctId, 'رحمة');
    assert.equal(byId('morphology-succeed-family').correctId, 'نجاح');
    assert.equal(byId('morphology-drink').level, 1);
    assert.equal(byId('morphology-drink').correctId, 'شرب');

    assert.equal(byId('morphology-open').level, 2);
    assert.equal(byId('morphology-open').correctId, 'فاتح');
    assert.match(byId('morphology-open').explanationAr, /اسْمُ فَاعِلٍ/);
    assert.equal(byId('morphology-playground').level, 2);
    assert.match(byId('morphology-playground').explanationAr, /اسْمُ مَكَانٍ/);

    assert.equal(byId('morphology-understand').level, 3);
    assert.equal(byId('morphology-understand').correctId, 'مفهوم');
    assert.match(byId('morphology-understand').explanationAr, /اسْمُ مَفْعُولٍ/);
    assert.equal(byId('morphology-write-passive').level, 3);
    assert.equal(byId('morphology-write-passive').correctId, 'مكتوب');
    assert.match(byId('morphology-write-passive').explanationAr, /اسْمُ مَفْعُولٍ/);
    assert.equal(byId('morphology-repaired').level, 3);
  });

  it('keeps fluency practice untimed and unscored', () => {
    const passage = getFluencyPassage(8);
    assert.ok(passage.linesAr.length >= 3);
    assert.equal(typeof passage.reflectionAr, 'string');
    assert.match(passage.reflectionAr, /دِقَّةٍ|عَلامَةِ/);
  });
});
