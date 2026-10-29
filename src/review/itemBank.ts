/**
 * The pre-launch content review bank: every unit a child sees or hears, and every text a
 * parent or teacher reads in the report, built directly from the product's own data so the
 * review always matches what ships. Used by the in-app review page (?review=1) and by
 * scripts/export-item-bank.ts.
 */
import { BATTERY, type ChoiceItem, type Visual } from '../cognitiveProfile/battery';
import { LEXICON } from '../cognitiveProfile/lexicon';
import { SKILLS, generateSession, type Level, type SkillId } from '../cognitiveProfile/training';
import { SUBTEST_GUIDANCE, RISK_META, PATTERN_META } from '../cognitiveProfile/guidance';
import { buildAudioCatalog } from '../cognitiveProfile/audioCatalog';
import { palWhere } from '../cognitiveProfile/phrases';
import { ARABIC_READING_PASSAGES } from '../data/seedData';

export type ReviewSection = 'lexicon' | 'battery' | 'training' | 'passages' | 'guidance' | 'audio';

export const SECTION_META: Record<ReviewSection, { titleAr: string; questionAr: string }> = {
  lexicon: {
    titleAr: 'المعجم المصوّر',
    questionAr: 'هل يعرف طفل في الرابعة هذه الكلمة، ويسمّي الصورة بها نفسها؟ هل التشكيل والمقاطع والصوت الأول والأخير صحيحة؟',
  },
  battery: {
    titleAr: 'بنود الفحص',
    questionAr: 'هل للبند إجابة واحدة صحيحة فقط؟ هل يقيس المهارة المكتوبة؟ هل الصور والكلمات والتعليمات واضحة لطفل من ٤ إلى ٨ سنوات؟',
  },
  training: {
    titleAr: 'تمارين البرنامج التدريبي',
    questionAr: 'هل التمرين صحيح، وإجابته واحدة، ومناسب لمستواه، ويدرّب المهارة المقصودة؟ (عيّنات من كل مهارة ومستوى؛ التمارين تُولَّد من القالب نفسه)',
  },
  passages: {
    titleAr: 'نصوص القراءة وأسئلة الفهم',
    questionAr: 'هل النص سليم لغويًا ومناسب لصفه؟ هل لكل سؤال إجابة واحدة صحيحة يمكن استنتاجها من النص؟',
  },
  guidance: {
    titleAr: 'نصوص التقرير والاستراتيجيات',
    questionAr: 'هل النص دقيق علميًا، لا يشخّص، ومفهوم للأسرة والمعلم؟ هل الاستراتيجيات والأنشطة مناسبة تربويًا؟',
  },
  audio: {
    titleAr: 'المقاطع الصوتية',
    questionAr: 'استمع: هل النطق مطابق للنص المكتوب بحركاته؟ هل الصوت واضح وبسرعة مناسبة لطفل صغير؟',
  },
};

export interface ReviewField {
  labelAr: string;
  text: string;
  /** Text to speak with the recorded clip, when this field is heard by the child. */
  audio?: string;
  /** Picture shown to the child (emoji). */
  picture?: string;
  /** Marks the expected correct answer. */
  correct?: boolean;
}

export interface ReviewUnit {
  id: string;
  section: ReviewSection;
  titleAr: string;
  subtitleAr?: string;
  fields: ReviewField[];
  /** Machine notes the reviewer should look at first (e.g. audio flagged for listening). */
  flagsAr: string[];
}

const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const visualText = (v?: Visual): { text: string; picture?: string } => {
  if (!v) return { text: '—' };
  if (v.type === 'emoji') return { text: v.label, picture: v.value };
  if (v.type === 'glyph') return { text: v.value };
  if (v.type === 'count') return { text: `${v.label}` };
  return { text: v.label };
};

function choiceUnit(prefix: string, section: ReviewSection, title: string, subtitle: string, item: ChoiceItem): ReviewUnit {
  const stim = visualText(item.stimulus);
  return {
    id: `${prefix}.${item.id}`,
    section,
    titleAr: title,
    subtitleAr: subtitle,
    fields: [
      { labelAr: 'السؤال المكتوب', text: item.promptAr },
      ...item.audio.map((a, i) => ({ labelAr: i === item.audio.length - 1 ? 'التعليمة المسموعة' : 'يسمع الطفل', text: a.text, audio: a.text })),
      ...(item.stimulus ? [{ labelAr: 'المثير', text: stim.text, picture: stim.picture }] : []),
      ...item.options.map((o) => {
        const v = visualText(o.visual);
        return { labelAr: o.id === item.correctId ? 'الخيار الصحيح' : 'خيار', text: v.text, picture: v.picture, correct: o.id === item.correctId };
      }),
    ],
    flagsAr: [],
  };
}

/**
 * Name-agreement risks to check first (a child may name the picture with another word, or
 * the word differs in Gulf dialects). These are hypotheses for the reviewer, not decisions:
 * name agreement is the strongest predictor of picture-naming success in the Gulf Arabic
 * norms (Khwaileh et al., 2018), and the items stay unchanged until checked with children
 * or against those norms.
 */
const FAMILIARITY_NOTES: Record<string, string> = {
  sword: 'الصورة خنجر؛ قد يسمّيه الطفل «سكين».',
  mouth: 'الصورة شفتان؛ قد يقول الطفل «شفايف» لا «فم».',
  window: 'في الخليج تُسمّى غالبًا «دريشة».',
  umbrella: 'في الخليج تُسمّى غالبًا «شمسية».',
  turtle: 'قد تُسمّى «حمسة» في بعض لهجات الخليج.',
  fox: 'قد يخلطه الطفل الصغير بالكلب.',
  snow: '«ثلج» في الخليج تعني غالبًا مكعبات الثلج؛ صورة ندفة الثلج قد لا يسمّيها الطفل.',
  rope: 'الصورة عقدة حبل، وقد لا يتعرّف عليها الطفل الصغير.',
  boat: 'قد يقول الطفل «سفينة» أو «مركب».',
  honey: 'الصورة جرّة؛ قد يقول الطفل «جرّة» أو «مرطبان».',
  rooster: 'قد يسمّي الطفل الديك «دجاجة»؛ تحقق ألّا يظهرا معًا في سؤال واحد.',
  chicken: 'قد يسمّي الطفل الدجاجة «ديك»؛ تحقق ألّا يظهرا معًا في سؤال واحد.',
  summer: 'لا تُسمّى الصورة «صيف» عادةً (يقول الطفل «بحر» أو «شاطئ»)؛ مستخدمة في بند الاستماع فقط.',
};

export function buildReviewUnits(manifest?: { clips: Record<string, { qa?: { status: string; recognized: string } }> }): ReviewUnit[] {
  const units: ReviewUnit[] = [];

  // Lexicon
  for (const e of Object.values(LEXICON)) {
    units.push({
      id: `lexicon.${e.id}`,
      section: 'lexicon',
      titleAr: e.word,
      fields: [
        { labelAr: 'الكلمة والصورة', text: e.word, picture: e.emoji, audio: e.word },
        { labelAr: 'المقاطع', text: e.syllables.join(' · ') },
        { labelAr: 'الصوت الأول', text: e.onset },
        { labelAr: 'الصوت الأخير', text: e.coda ?? '— (تاء مربوطة)' },
      ],
      flagsAr: FAMILIARITY_NOTES[e.id] ? [`للتحقق — ${FAMILIARITY_NOTES[e.id]}`] : [],
    });
  }

  // Battery
  for (const s of BATTERY) {
    const title = `${s.gameNameAr} — ${s.skillNameAr}`;
    units.push({
      id: `battery.${s.id}.intro`,
      section: 'battery',
      titleAr: title,
      subtitleAr: 'تعليمات اللعبة',
      fields: [
        { labelAr: 'التعليمة المسموعة', text: s.introAudio, audio: s.introAudio },
        { labelAr: 'ملاحظة للفاحص', text: s.examinerNoteAr },
      ],
      flagsAr: [],
    });
    if (s.kind === 'choice') {
      s.practice.forEach((it) => units.push(choiceUnit(`battery.${s.id}`, 'battery', title, `بند تدريبي ${it.id}`, it)));
      s.items.forEach((it) => units.push(choiceUnit(`battery.${s.id}`, 'battery', title, `بند محتسب ${it.id}`, it)));
    } else if (s.kind === 'span') {
      [...s.practice.map((t) => ({ t, kind: 'تدريبية' })), ...s.trials.map((t) => ({ t, kind: 'محتسبة' }))].forEach(({ t, kind }) =>
        units.push({
          id: `battery.${s.id}.${t.id}`,
          section: 'battery',
          titleAr: title,
          subtitleAr: `محاولة ${kind} ${t.id} (${ar(t.sequence.length)} صور)`,
          fields: [
            ...t.sequence.map((id, i) => ({ labelAr: `الترتيب ${ar(i + 1)}`, text: LEXICON[id].word, picture: LEXICON[id].emoji, audio: LEXICON[id].word })),
            { labelAr: 'صور الاختيار', text: t.choices.map((id) => LEXICON[id].word).join('، ') },
          ],
          flagsAr: [],
        })
      );
    } else if (s.kind === 'association') {
      [...s.practice, ...s.blocks].forEach((b) =>
        units.push({
          id: `battery.${s.id}.${b.id}`,
          section: 'battery',
          titleAr: title,
          subtitleAr: `مجموعة ${b.id}`,
          fields: b.residents.map((id, i) => ({ labelAr: `البيت ${ar(i + 1)}`, text: LEXICON[id].word, picture: LEXICON[id].emoji })),
          flagsAr: [],
        })
      );
    } else if (s.kind === 'pal') {
      units.push({
        id: `battery.${s.id}.creatures`,
        section: 'battery',
        titleAr: title,
        subtitleAr: 'أسماء المخلوقات',
        fields: s.creatures.map((c) => ({ labelAr: 'اسم يتعلمه الطفل', text: c.name, audio: palWhere(c.name) })),
        flagsAr: [],
      });
    }
  }

  // Training samples: every skill and level, first items of two sessions.
  for (const skill of Object.keys(SKILLS) as SkillId[]) {
    for (const level of [1, 2, 3] as Level[]) {
      for (const seed of [1, 2]) {
        generateSession(skill, level, seed)
          .slice(0, 3)
          .forEach((t, i) => {
            const title = `${SKILLS[skill].nameAr} — المستوى ${ar(level)}`;
            if (t.kind === 'choice') {
              units.push({ ...choiceUnit(`training.${skill}.${level}.${seed}.${i}`, 'training', title, SKILLS[skill].levels[level], t.item), id: `training.${skill}.${level}.${seed}.${i}` });
            } else {
              units.push({
                id: `training.${skill}.${level}.${seed}.${i}`,
                section: 'training',
                titleAr: title,
                subtitleAr: SKILLS[skill].levels[level],
                fields: t.trial.sequence.map((id, k) => ({ labelAr: `الترتيب ${ar(k + 1)}`, text: LEXICON[id].word, picture: LEXICON[id].emoji, audio: LEXICON[id].word })),
                flagsAr: [],
              });
            }
          });
      }
    }
  }

  // Reading passages
  for (const p of ARABIC_READING_PASSAGES) {
    units.push({
      id: `passage.${p.id}`,
      section: 'passages',
      titleAr: p.title,
      subtitleAr: `${p.gradeLabel} · ${p.diacriticLabelAr}`,
      fields: [
        { labelAr: 'النص', text: p.words.join(' ') },
        ...p.comprehensionQuestions.flatMap((q, i) => [
          { labelAr: `سؤال ${ar(i + 1)} (${q.skillLabelAr})`, text: q.question },
          ...q.options.map((o, k) => ({ labelAr: k === q.correctIndex ? 'الإجابة الصحيحة' : 'خيار', text: o, correct: k === q.correctIndex })),
        ]),
      ],
      flagsAr: [],
    });
  }

  // Report guidance
  for (const s of BATTERY) {
    const g = SUBTEST_GUIDANCE[s.id];
    units.push({
      id: `guidance.${s.id}`,
      section: 'guidance',
      titleAr: s.skillNameAr,
      fields: [
        { labelAr: 'ماذا يقيس', text: g.measuresAr },
        { labelAr: 'لماذا يهم', text: g.whyItMattersAr },
        { labelAr: 'معنى الضعف', text: g.weaknessMeaningAr },
        ...g.strategiesAr.map((t) => ({ labelAr: 'استراتيجية صفية', text: t })),
        ...g.homeActivitiesAr.map((t) => ({ labelAr: 'نشاط منزلي', text: t })),
        { labelAr: 'الاستفادة من القوة', text: g.strengthUseAr },
      ],
      flagsAr: [],
    });
  }
  for (const [id, r] of Object.entries(RISK_META)) units.push({ id: `guidance.risk.${id}`, section: 'guidance', titleAr: r.labelAr, fields: [{ labelAr: 'نص التقرير', text: r.summaryAr }], flagsAr: [] });
  for (const [id, p] of Object.entries(PATTERN_META)) units.push({ id: `guidance.pattern.${id}`, section: 'guidance', titleAr: p.titleAr, fields: [{ labelAr: 'نص التقرير', text: p.textAr }], flagsAr: [] });

  // Audio: every clip; machine-flagged ones first.
  const catalog = buildAudioCatalog();
  const rank = (s?: string) => (s === 'fail' ? 0 : s === 'listen' ? 1 : s ? 2 : 0);
  catalog
    .map((e) => ({ e, qa: manifest?.clips[e.key]?.qa }))
    .sort((a, b) => rank(a.qa?.status) - rank(b.qa?.status))
    .forEach(({ e, qa }) =>
      units.push({
        id: `audio.${e.key}`,
        section: 'audio',
        titleAr: e.text,
        subtitleAr: `يُستخدم في: ${e.sources.slice(0, 3).join('، ')}${e.sources.length > 3 ? '…' : ''}`,
        fields: [{ labelAr: 'النص المقصود', text: e.text, audio: e.text }],
        flagsAr: !manifest
          ? []
          : !manifest.clips[e.key]
            ? ['لا يوجد تسجيل لهذا النص']
            : qa?.status === 'fail'
              ? [`الفحص الآلي: غير مطابق. سمع «${qa.recognized}»`]
              : qa?.status === 'listen'
                ? [`الفحص الآلي يطلب استماعًا بشريًا${qa.recognized ? ` (سمع «${qa.recognized}»)` : ''}`]
                : [],
      })
    );

  return units;
}
