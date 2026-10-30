/**
 * Gulf Arabic picture-naming norms for the words in our lexicon.
 *
 * Source: Khwaileh, T., Mustafawi, E., Herbert, R., & Howard, D. (2018). Gulf Arabic nouns and verbs:
 * A standardized set of 319 object pictures and 141 action pictures, with predictors of naming latencies.
 * Behavior Research Methods, 50, 2408–2425. https://doi.org/10.3758/s13428-018-1019-6
 * Item data: "Gulf Picturable Nouns" sheet from the authors' database (qufaculty.qu.edu.qa/tariq-khwaileh/download-center).
 *
 * 170 Qatari adults (18–51 years). The ratings are adults' estimates, not measurements on children.
 * - nameAgreement: share of participants who gave the modal name to the study's own line drawing (0–1).
 *   It describes that drawing, not our pictures.
 * - ageOfAcquisition: 1–7 scale in two-year bands (1 = 0–2 years, 2 = 3–4, 3 = 5–6, 4 = 7–8, 5 = 9–10, 6 = 11–12, 7 = 13+).
 * - familiarity: 1–5 (5 = met very often), rated on the dialect word.
 * - gulfForm: the Gulf dialect form listed by the authors; modalName: the name most participants gave
 *   (short-vowel marks removed, because the source marks them inconsistently).
 * `concept` is the study's item when it differs from our word (for example our 👄 is the study's "Lips").
 *
 * Words with no entry (summer, rain, honey, hand, rope, milk, bread, snow, ear) are not in the database.
 * Regenerate only from the source file; do not edit the numbers by hand.
 */
export interface GulfNorm {
  concept: string;
  gulfForm: string;
  modalName: string;
  nameAgreement: number;
  ageOfAcquisition: number;
  familiarity: number;
}

/** Mean rating of 4 = understood at 7–8 years: later than the youngest children the battery screens. */
export const LATE_AGE_OF_ACQUISITION = 4;
/** Below 60% the drawing has a common competing name. */
export const LOW_NAME_AGREEMENT = 0.6;

export const GULF_NORMS_SOURCE = 'Khwaileh, Mustafawi, Herbert & Howard (2018), Behavior Research Methods 50:2408–2425';

export const GULF_NORMS: Record<string, GulfNorm> = {
  cat: { concept: 'Cat', gulfForm: 'قطوة', modalName: 'قطوة', nameAgreement: 0.82, ageOfAcquisition: 2.73, familiarity: 4.3 },
  duck: { concept: 'Duck', gulfForm: 'بطة', modalName: 'بطة', nameAgreement: 0.89, ageOfAcquisition: 3.18, familiarity: 3.24 },
  dog: { concept: 'Dog', gulfForm: 'تشلب', modalName: 'كلب', nameAgreement: 1, ageOfAcquisition: 2.89, familiarity: 3.82 },
  heart: { concept: 'Heart', gulfForm: 'قلب', modalName: 'قلب', nameAgreement: 1, ageOfAcquisition: 5.49, familiarity: 4.16 },
  bee: { concept: 'Bee', gulfForm: 'نحلة', modalName: 'نحلة', nameAgreement: 1, ageOfAcquisition: 3.11, familiarity: 3.16 },
  palm: { concept: 'PalmTree', gulfForm: 'انخلة', modalName: 'نخلة', nameAgreement: 0.86, ageOfAcquisition: 3.09, familiarity: 3.56 },
  sword: { concept: 'Sword', gulfForm: 'سيف', modalName: 'سيف', nameAgreement: 1, ageOfAcquisition: 3.81, familiarity: 3.1 },
  sun: { concept: 'Sun', gulfForm: 'شمس', modalName: 'شمس', nameAgreement: 1, ageOfAcquisition: 2.53, familiarity: 4.54 },
  moon: { concept: 'Moon', gulfForm: 'قمر', modalName: 'قمر', nameAgreement: 0.45, ageOfAcquisition: 2.91, familiarity: 4.62 },
  door: { concept: 'Door', gulfForm: 'باب', modalName: 'باب', nameAgreement: 1, ageOfAcquisition: 2.53, familiarity: 4.64 },
  book: { concept: 'Book', gulfForm: 'اكتاب', modalName: 'كتاب', nameAgreement: 1, ageOfAcquisition: 3.49, familiarity: 4.28 },
  house: { concept: 'House', gulfForm: 'بيت', modalName: 'بيت', nameAgreement: 1, ageOfAcquisition: 2.75, familiarity: 4.6 },
  pen: { concept: 'Pen', gulfForm: 'قلم', modalName: 'قلم', nameAgreement: 1, ageOfAcquisition: 2.84, familiarity: 4.66 },
  flag: { concept: 'Flag', gulfForm: 'علم', modalName: 'علم', nameAgreement: 1, ageOfAcquisition: 4.02, familiarity: 3.48 },
  mouth: { concept: 'Lips', gulfForm: 'شفايف', modalName: 'شفايف', nameAgreement: 0.8, ageOfAcquisition: 3.44, familiarity: 3.88 },
  camel: { concept: 'Camel', gulfForm: 'جمل', modalName: 'جمل', nameAgreement: 1, ageOfAcquisition: 3.24, familiarity: 3.66 },
  fish: { concept: 'Fish', gulfForm: 'سمتشة', modalName: 'اسمتشة', nameAgreement: 0.79, ageOfAcquisition: 3.15, familiarity: 3.84 },
  elephant: { concept: 'Elephant', gulfForm: 'فيل', modalName: 'فيل', nameAgreement: 1, ageOfAcquisition: 2.93, familiarity: 3.22 },
  banana: { concept: 'Banana', gulfForm: 'موزة', modalName: 'موزة', nameAgreement: 0.57, ageOfAcquisition: 2.36, familiarity: 4.2 },
  apple: { concept: 'Apple', gulfForm: 'تفاحة', modalName: 'تفاحة', nameAgreement: 0.82, ageOfAcquisition: 2.8, familiarity: 4.14 },
  ball: { concept: 'Ball', gulfForm: 'كورة', modalName: 'كورة', nameAgreement: 1, ageOfAcquisition: 2.53, familiarity: 3.9 },
  corn: { concept: 'Corn', gulfForm: 'ذرة', modalName: 'ذرة', nameAgreement: 1, ageOfAcquisition: 3.62, familiarity: 3.36 },
  car: { concept: 'Car', gulfForm: 'سيارة', modalName: 'سيارة', nameAgreement: 1, ageOfAcquisition: 2.89, familiarity: 4.68 },
  lion: { concept: 'Lion', gulfForm: 'أسد', modalName: 'أسد', nameAgreement: 1, ageOfAcquisition: 3.09, familiarity: 3.42 },
  rabbit: { concept: 'Rabbit', gulfForm: 'أرنب', modalName: 'أرنب', nameAgreement: 1, ageOfAcquisition: 2.96, familiarity: 3.2 },
  grapes: { concept: 'Grapes', gulfForm: 'عنب', modalName: 'عنب', nameAgreement: 1, ageOfAcquisition: 2.8, familiarity: 3.84 },
  fox: { concept: 'Fox', gulfForm: 'ثعلب', modalName: 'ثعلب', nameAgreement: 1, ageOfAcquisition: 3.71, familiarity: 2.98 },
  horse: { concept: 'Horse', gulfForm: 'خيل', modalName: 'حصان', nameAgreement: 1, ageOfAcquisition: 3.09, familiarity: 3.78 },
  dress: { concept: 'Dress', gulfForm: 'فستان', modalName: 'فستان', nameAgreement: 1, ageOfAcquisition: 3.2, familiarity: 4.1 },
  bell: { concept: 'Bell', gulfForm: 'جرس', modalName: 'جرس', nameAgreement: 1, ageOfAcquisition: 3.6, familiarity: 3.86 },
  drum: { concept: 'Drum', gulfForm: 'طبل', modalName: 'طبل', nameAgreement: 0.59, ageOfAcquisition: 4, familiarity: 3.12 },
  carrot: { concept: 'Carrot', gulfForm: 'يزر', modalName: 'جزر', nameAgreement: 0.89, ageOfAcquisition: 3.02, familiarity: 3.6 },
  tree: { concept: 'Tree', gulfForm: 'اشيرة', modalName: 'شيرة', nameAgreement: 1, ageOfAcquisition: 3.22, familiarity: 4.16 },
  cow: { concept: 'Cow', gulfForm: 'ابقرة', modalName: 'بقرة', nameAgreement: 1, ageOfAcquisition: 3.27, familiarity: 3.46 },
  bear: { concept: 'Bear', gulfForm: 'دب', modalName: 'دب', nameAgreement: 1, ageOfAcquisition: 2.75, familiarity: 3.48 },
  rooster: { concept: 'Rooster', gulfForm: 'ديتش', modalName: 'ديك', nameAgreement: 0.84, ageOfAcquisition: 3.35, familiarity: 3.46 },
  window: { concept: 'Window', gulfForm: 'دريشة', modalName: 'دريشة', nameAgreement: 0.75, ageOfAcquisition: 3.13, familiarity: 4.38 },
  orange: { concept: 'Orange', gulfForm: 'برتقالة', modalName: 'برتقالة', nameAgreement: 0.41, ageOfAcquisition: 2.67, familiarity: 4.1 },
  turtle: { concept: 'Turtle', gulfForm: 'سلحفاة', modalName: 'سلحفاة', nameAgreement: 1, ageOfAcquisition: 3.22, familiarity: 3.18 },
  frog: { concept: 'Frog', gulfForm: 'ضفدع', modalName: 'ضفدع', nameAgreement: 1, ageOfAcquisition: 3.64, familiarity: 3.08 },
  key: { concept: 'Key', gulfForm: 'مفتاح', modalName: 'مفتاح', nameAgreement: 1, ageOfAcquisition: 3.24, familiarity: 4.32 },
  star: { concept: 'Star', gulfForm: 'نجمة', modalName: 'نجمة', nameAgreement: 1, ageOfAcquisition: 2.78, familiarity: 3.6 },
  mouse: { concept: 'Mouse', gulfForm: 'فار', modalName: 'فار', nameAgreement: 1, ageOfAcquisition: 3.39, familiarity: 3.02 },
  eye: { concept: 'Eye', gulfForm: 'عين', modalName: 'عين', nameAgreement: 0.8, ageOfAcquisition: 2.36, familiarity: 4.36 },
  fire: { concept: 'Fire', gulfForm: 'نار', modalName: 'نار', nameAgreement: 0.77, ageOfAcquisition: 2.91, familiarity: 3.64 },
  umbrella: { concept: 'Umbrella', gulfForm: 'مظلة', modalName: 'مظلة', nameAgreement: 1, ageOfAcquisition: 3.27, familiarity: 3.72 },
  egg: { concept: 'Egg', gulfForm: 'بيضة', modalName: 'بيضة', nameAgreement: 0.66, ageOfAcquisition: 3.02, familiarity: 4.24 },
  chicken: { concept: 'Chicken', gulfForm: 'دياية', modalName: 'دياية', nameAgreement: 0.7, ageOfAcquisition: 2.91, familiarity: 4.18 },
  boat: { concept: 'Sailboat', gulfForm: 'قارب', modalName: 'قارب', nameAgreement: 0.41, ageOfAcquisition: 3.07, familiarity: 3.44 },
  plane: { concept: 'Airplane', gulfForm: 'طيارة', modalName: 'طيارة', nameAgreement: 1, ageOfAcquisition: 3.24, familiarity: 3.96 },
  tiger: { concept: 'Tiger', gulfForm: 'نمر', modalName: 'نمر', nameAgreement: 1, ageOfAcquisition: 3.42, familiarity: 3.1 },
  watch: { concept: 'Watch', gulfForm: 'ساعة', modalName: 'ساعة', nameAgreement: 0.89, ageOfAcquisition: 3.36, familiarity: 4.6 },
  chair: { concept: 'Chair', gulfForm: 'كرسي', modalName: 'كرسي', nameAgreement: 1, ageOfAcquisition: 2.85, familiarity: 4.4 },
};
