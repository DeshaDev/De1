import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPELLING_LESSONS,
  FLUENCY_PASSAGES,
  LEVELED_STORIES,
  getSpellingLesson,
  getFluencyPassageById,
  getLeveledStoryById,
  getRecommendedFluencyPassage,
  getRecommendedStoriesForGrade,
} from './literacyStudio';

describe('Arabic Literacy Studio Data & Pedagogy Integrity', () => {
  describe('Spelling & Orthography Gym', () => {
    it('contains comprehensive spelling topics with 4-step explicit architecture', () => {
      assert.ok(SPELLING_LESSONS.length >= 6, 'Should have at least 6 core Arabic orthography topics');

      for (const lesson of SPELLING_LESSONS) {
        assert.ok(lesson.id, 'Lesson must have an id');
        assert.ok(lesson.titleAr, 'Lesson must have an Arabic title');
        assert.ok(lesson.ruleSummaryAr, `Lesson ${lesson.id} must have a clear rule summary`);
        assert.ok(lesson.ruleAudioTextAr, `Lesson ${lesson.id} must have fully vowelled audio text`);

        // Step 2: Worked Example
        assert.ok(lesson.workedExample.targetWord, `Lesson ${lesson.id} must have a worked example word`);
        assert.ok(lesson.workedExample.visualBreakdown.length > 0, `Lesson ${lesson.id} must have visual syllable breakdown`);
        assert.ok(lesson.workedExample.proofTipAr, `Lesson ${lesson.id} must have a verification rule tip`);

        // Step 3: Guided Practice
        assert.ok(lesson.guidedPractices.length >= 1, `Lesson ${lesson.id} must have guided practices`);
        for (const practice of lesson.guidedPractices) {
          assert.ok(practice.options.length >= 2, 'Practice must offer at least 2 choices');
          const correctExists = practice.options.some((o) => o.id === practice.correctId);
          assert.ok(correctExists, `Correct ID ${practice.correctId} must exist in options for ${practice.id}`);
          assert.ok(practice.hintAr, `Practice ${practice.id} must provide immediate hint`);
        }

        // Step 4: Independent Application
        assert.ok(lesson.independentTask.targetWord, `Lesson ${lesson.id} must have an independent application word`);
        assert.ok(lesson.independentTask.scrambledSyllables.length >= 2, `Lesson ${lesson.id} must have syllable tiles to assemble`);
      }
    });

    it('correctly retrieves spelling lesson by id', () => {
      const lesson = getSpellingLesson('ta_marbuta_open');
      assert.ok(lesson);
      assert.equal(lesson?.id, 'ta_marbuta_open');
      assert.equal(getSpellingLesson('non_existent'), undefined);
    });
  });

  describe('Expressive Fluency Studio', () => {
    it('contains phrase-cued passages differentiated by grade level', () => {
      assert.ok(FLUENCY_PASSAGES.length >= 3, 'Should cover grades 1, 2, and 3');

      for (const passage of FLUENCY_PASSAGES) {
        assert.ok(passage.id);
        assert.ok(passage.titleAr);
        assert.ok(passage.phrasedLines.length >= 4, `Passage ${passage.id} must have at least 4 phrased lines`);
        assert.ok(passage.recommendedWcpmRange[0] < passage.recommendedWcpmRange[1], 'WCPM range must be valid');
        assert.ok(passage.punctuationTipsAr.length >= 2, 'Must include punctuation and pause guidance');

        // Check each line has text and valid pause indicator
        for (const line of passage.phrasedLines) {
          assert.ok(line.textAr.trim().length > 0, 'Line text must not be empty');
          assert.ok(['comma', 'period', 'question', 'none'].includes(line.pauseAfter));
        }
      }
    });

    it('recommends appropriate fluency passage for grade', () => {
      const p1 = getRecommendedFluencyPassage(1);
      assert.equal(p1.gradeLevel, 1);
      const p2 = getRecommendedFluencyPassage(2);
      assert.equal(p2.gradeLevel, 2);
      const p3 = getRecommendedFluencyPassage(3);
      assert.equal(p3.gradeLevel, 3);
    });
  });

  describe('Smart Leveled Arabic Story Library', () => {
    it('contains graded stories with complete text, vocabulary, and quizzes', () => {
      assert.ok(LEVELED_STORIES.length >= 3, 'Should have at least 3 leveled stories');

      for (const story of LEVELED_STORIES) {
        assert.ok(story.id);
        assert.ok([1, 2, 3].includes(story.level), 'Story level must be 1, 2, or 3');
        assert.ok(story.titleAr);
        assert.ok(story.coverEmoji);
        assert.ok(story.pages.length >= 2, `Story ${story.id} must have at least 2 pages`);
        assert.ok(story.vocabularySpotlight.length >= 1, `Story ${story.id} must spotlight vocabulary`);
        assert.ok(story.comprehensionQuiz.length >= 2, `Story ${story.id} must have comprehension questions`);

        for (const q of story.comprehensionQuiz) {
          assert.ok(q.options.length >= 2, `Question ${q.id} must have options`);
          assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `Correct index out of bounds in ${q.id}`);
          assert.ok(q.explanationAr, `Question ${q.id} must have feedback explanation`);
        }
      }
    });

    it('correctly retrieves story by id and filters by grade', () => {
      const story = getLeveledStoryById('story_l1_cat_market');
      assert.ok(story);
      assert.equal(story?.level, 1);

      const earlyStories = getRecommendedStoriesForGrade(1);
      assert.ok(earlyStories.every((s) => s.level <= 2));

      const olderStories = getRecommendedStoriesForGrade(3);
      assert.equal(olderStories.length, LEVELED_STORIES.length);
    });
  });
});
