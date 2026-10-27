import fs from 'fs';
import path from 'path';
import {
  getCurriculumLesson,
  READING_CURRICULUM_SEQUENCE,
  CurriculumSkillId,
} from '../../src/utils/evidenceBasedCurriculum';
import { ARABIC_READING_PASSAGES } from '../../src/data/seedData';

const outPath = path.resolve('tools/arabic-auditor/exported_arabic_content.json');

const allSkillIds: { id: CurriculumSkillId; domain: 'reading' }[] =
  READING_CURRICULUM_SEQUENCE.map((skill) => ({
    id: skill.id as CurriculumSkillId,
    domain: 'reading',
  }));

const questions: any[] = [];
for (const item of allSkillIds) {
  const lesson = getCurriculumLesson(item.domain, item.id);
  if (!lesson) continue;
  for (const q of lesson.questions) {
    questions.push({
      domain: item.domain,
      skillId: lesson.id,
      skillTitle: lesson.title,
      skillObjective: lesson.objective,
      questionId: q.id,
      prompt: q.prompt,
      stimulus: q.stimulus,
      options: q.options,
      correctIndex: q.correctIndex,
      correctAnswer: q.options[q.correctIndex],
      feedbackCorrect: q.feedbackCorrect,
      scaffold: q.scaffold,
      hideStimulus: q.hideStimulus,
      dotCount: q.dotCount,
    });
  }
}

const passages = ARABIC_READING_PASSAGES.map((p) => ({
  id: p.id,
  title: p.title,
  gradeLevel: p.gradeLevel,
  gradeLabel: p.gradeLabel,
  category: p.category,
  diacriticLevel: p.diacriticLevel,
  diacriticLabelAr: p.diacriticLabelAr,
  wordCount: p.wordCount,
  words: p.words,
  fullText: p.words.join(' '),
  targetSkillsAr: p.targetSkillsAr,
  comprehensionQuestions: p.comprehensionQuestions,
}));

fs.writeFileSync(outPath, JSON.stringify({ questions, passages }, null, 2), 'utf-8');
console.log(`Successfully exported ${questions.length} questions and ${passages.length} passages to ${outPath}`);
