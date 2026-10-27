import {
  SubitizingTrialResult,
  NumberLineTrialResult,
  TranscodingTrialResult,
} from '../utils/learningMetrics';

export interface LearningReport {
  learningSummary: string;
  ocularMotorAnalysis: string;
  orthographicAndPhonologicalPatterns: string;
  dyscalculiaSpatialAnalysis: string;
  interventionExercises: {
    title: string;
    durationMinutes: number;
    description: string;
  }[];
  classroomAccommodations: string[];
}

export type ReadingComprehensionSkillType =
  | 'literal_recall'
  | 'inferential'
  | 'vocabulary_context'
  | 'main_idea';

export interface ComprehensionQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  skillType: ReadingComprehensionSkillType;
  skillLabelAr: string;
}

export interface ReadingPassage {
  id: string;
  title: string;
  gradeLevel: number;
  gradeLabel: string;
  category: string;
  diacriticLevel: 'full' | 'partial' | 'minimal';
  diacriticLabelAr: string;
  difficultyBand: 'foundational' | 'intermediate' | 'advanced';
  wordCount: number;
  targetSkillsAr: string[];
  words: string[];
  comprehensionQuestions: ComprehensionQuestion[];
}

export interface StudentAssessmentSnapshot {
  sessionId: string;
  completedAt: string;
  passageId: string;
  /** Reading modality is retained so history never conflates silent WPM with oral WCPM. */
  assessmentModality?: 'voice_only' | 'reading_only';
  wcpm?: number | null;
  teacherVerified?: boolean;
  wpm: number;
  comprehensionScore: number;
  problematicWords: string[];
  cognitiveResults?: CognitiveScreeningData | null;
  dyslexiaRiskScore: number | null;
  readingHeuristicIndicator: number | null;
  readingRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
  subitizingAccuracy: number | null;
  numberLinePAE: number | null;
  transcodingAccuracy: number | null;
  dyscalculiaRiskScore: number | null;
  mathRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
}

export interface CognitiveScreeningData {
  ranSpeedItemsPerSec: number;
  ranDurationSeconds: number;
  ranHesitationCount: number;
  ranCategory: 'colors' | 'digits' | 'objects';
  ranStatus: 'fast' | 'average' | 'slow_at_risk' | 'unassessed';
  ranStatusLabelAr: string;
  pseudoWordScorePercent: number;
  pseudoWordWordsRead: number;
  pseudoWordTotalCount: number;
  phonemicAwarenessScorePercent: number;
  completedAt: string;
}

export interface StudentMathTrialsPayload {
  subitizingTrials: SubitizingTrialResult[];
  numberLineTrials: NumberLineTrialResult[];
  transcodingTrials: TranscodingTrialResult[];
}

export interface StudentRecord {
  id: string;
  /** Set by the server from the signed session; never trusted from client input. */
  tenantId?: string;
  name: string;
  isDemoRecord?: boolean;
  sessionStatus?: 'in_progress' | 'completed';
  sessionCompletedAt?: string;
  sessionRoleLabel?: string;
  assessmentHistory?: StudentAssessmentSnapshot[];
  cognitiveResults?: CognitiveScreeningData | null;
  assessmentModality?: 'voice_only' | 'reading_only';
  /** Explicit provenance tag distinguishing client-reported evidence from server-verified audio or synthetic demos. */
  evidenceProvenance?: 'client-reported' | 'server-verified-audio' | 'demo-synthetic';
  evidenceProvenanceLabelAr?: string;
  gradeLevel: number;
  ageYears: number;
  schoolName: string;
  lastScreenedDate: string;
  passageId: string;
  dialectRegionAr?: string;
  dialectCode?: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi';
  dialect?: 'msa' | 'gulf' | 'egyptian' | 'levantine' | 'maghrebi';
  /** Elapsed screen-reading duration in seconds; sent as evidence for server-side scoring. */
  readingDurationSeconds?: number;
  /** Raw answer indices for server-side comprehension scoring. */
  comprehensionAnswers?: number[];
  guardianConsentGiven?: boolean;
  guardianConsentRecordedAt?: string;
  guardianConsentSource?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianConsentPeriod?: string;
  teacherVerified?: boolean;
  /** True only when the server validated a short-lived receipt for a completed Azure audio assessment. */
  aiAssessmentVerified?: boolean;
  aiAssessmentSource?: 'azure_pronunciation_assessment';
  /** Transient receipt passed back once to the session-save endpoint; never persisted in the student record. */
  aiAssessmentReceipt?: string;
  teacherVerifierId?: string;
  teacherVerifierName?: string;
  teacherVerifierRole?: string;
  teacherVerificationTimestamp?: string;
  teacherWordOverridesCount?: number;
  verifiedWordsAlignment?: Array<{
    word: string;
    status: 'correct' | 'dialect_variant' | 'phonetic_substitution' | 'omitted' | 'unconfirmed';
    spokenWord?: string | null;
  }>;
  guardianAudioConsentGiven?: boolean;
  audioRecordingConsentGiven?: boolean;
  audioRecordingStarted?: boolean;
  guardianAudioConsentRecordedAt?: string;
  speechRecognitionUsed?: boolean;
  // Reading performance metrics (no camera, video, or eye-tracking data)
  wpm: number;
  wcpm?: number | null;
  // Oral Reading Phonological & Dialect Alignment metrics
  oralReadingAssessed?: boolean;
  spokenTranscript?: string;
  oralWcpm?: number | null;
  oralAccuracyPercent?: number | null;
  oralWerPercent?: number | null;
  phoneticSubstitutionCount?: number;
  dialectVariantCount?: number;
  omissionCount?: number;
  // Heuristic Dyslexia Screening Score
  dyslexiaRiskScore: number | null;
  readingHeuristicIndicator: number | null;
  readingRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
  readingRiskLabelAr: string;
  problematicWords: string[];
  comprehensionScore: number; // 0-100
  // Dyscalculia metrics (explicitly supports unassessed state until Dyscalculia Lab is completed)
  dyscalculiaAssessed?: boolean;
  mathTrials?: StudentMathTrialsPayload;
  subitizingAccuracy: number | null;
  avgSubitizingMs: number | null;
  numberLinePAE: number | null;
  transcodingAccuracy: number | null;
  reversalErrorCount: number | null;
  dyscalculiaRiskScore: number | null;
  mathHeuristicIndicator: number | null;
  mathRiskLevel: 'nominal' | 'moderate' | 'high' | 'unassessed';
  mathRiskLabelAr: string;
  learningReport: LearningReport;
}

const G2_GARDEN_WORDS = [
  'خَرَجَتْ',
  'سَلْمَى',
  'صَبَاحاً',
  'إِلَى',
  'حَدِيقَةِ',
  'الْبَيْتِ',
  'الصَّغِيرَةِ.',
  'شَاهَدَتْ',
  'قِطَّةً',
  'بَيْضَاءَ',
  'تَجْلِسُ',
  'تَحْتَ',
  'شَجَرَةِ',
  'التُّفَّاحِ.',
  'كَانَتِ',
  'الْقِطَّةُ',
  'تَبْدُو',
  'جَائِعَةً',
  'وَتَنْظُرُ',
  'بِهُدُوءٍ',
  'إِلَى',
  'الْبَابِ.',
  'أَحْضَرَتْ',
  'سَلْمَى',
  'إِنَاءً',
  'نَظِيفاً',
  'فِيهِ',
  'مَاءٌ',
  'عَذْبٌ',
  'وَطَعَامٌ',
  'مُنَاسِبٌ.',
  'شَرِبَتِ',
  'الْقِطَّةُ',
  'الْمَاءَ',
  'وَأَكَلَتْ',
  'ثُمَّ',
  'لَعِبَتْ',
  'بِالْكُرَةِ',
  'الْحَمْرَاءِ',
  'فَرِحَةً',
  'بَيْنَ',
  'الزُّهُورِ',
  'الْمُلَوَّنَةِ.',
  'ابْتَسَمَتِ',
  'الْأُمُّ',
  'وَقَالَتْ:',
  'الرِّفْقُ',
  'بِالْحَيَوَانِ',
  'عَمَلٌ',
  'جَمِيلٌ',
  'يَا',
  'سَلْمَى.',
];

const G3_MARKET_WORDS = [
  'ذَهَبَ',
  'طَارِقٌ',
  'مَعَ',
  'وَالِدِهِ',
  'يَوْمَ',
  'الْجُمُعَةِ',
  'إِلَى',
  'سُوقِ',
  'الْحَيِّ',
  'الْقَرِيبِ.',
  'حَمَلَ',
  'طَارِقٌ',
  'سَلَّةً',
  'مِنَ',
  'السَّعَفِ',
  'لِيَضَعَ',
  'فِيهَا',
  'الْفَاكِهَةَ',
  'الطَّازَجَةَ.',
  'تَوَقَّفَ',
  'الْوَالِدُ',
  'أَمَامَ',
  'مَتْجَرٍ',
  'مُرَتَّبٍ',
  'تَفُوحُ',
  'مِنْهُ',
  'رَائِحَةُ',
  'الْفَوَاكِهِ',
  'الزَّكِيَّةُ.',
  'اشْتَرَى',
  'الْوَالِدُ',
  'عِنَباً',
  'أَخْضَرَ',
  'وَتِيناً',
  'حُلْواً',
  'وَبُرْتُقَالاً',
  'كَثِيراً',
  'لِأُسْرَتِهِ.',
  'وَزَنَ',
  'الْبَائِعُ',
  'الْفَاكِهَةَ',
  'بِالْمِيزَانِ',
  'بِدِقَّةٍ،',
  'ثُمَّ',
  'شَكَرَ',
  'طَارِقاً',
  'عَلَى',
  'مُسَاعَدَتِهِ',
  'لِوَالِدِهِ',
  'وَأَهْدَاهُ',
  'تُفَّاحَةً',
  'حَمْرَاءَ',
  'لَذِيذَةً.',
];

const G3_ASTRONOMY_WORDS = [
  'زَارَ',
  'طُلَّابُ',
  'المَدْرَسَةِ',
  'المَرْصَدَ',
  'الفَلَكِيَّ',
  'فِي',
  'مَسَاءٍ',
  'صَافٍ',
  'لِمُشَاهَدَةِ',
  'الكَوَاكِبِ',
  'المُضِيئَةِ.',
  'اسْتَقْبَلَهُمُ',
  'البَاحِثُ',
  'فِي',
  'قَاعَةِ',
  'العَرْضِ',
  'وَشَرَحَ',
  'لَهُمْ',
  'حَرَكَةَ',
  'الأَرْضِ',
  'حَوْلَ',
  'الشَّمْسِ.',
  'وَضَعَ',
  'المُهَنْدِسُ',
  'المِنْظَارَ',
  'الدَّقِيقَ',
  'نَحْوَ',
  'السَّمَاءِ،',
  'فَظَهَرَتْ',
  'حَلَقَاتُ',
  'كَوْكَبِ',
  'زُحَلَ',
  'الوَاضِحَةُ',
  'أَمَامَ',
  'الجَمِيعِ.',
  'سَجَّلَ',
  'الأَطْفَالُ',
  'مُلَاحَظَاتِهِمْ',
  'فِي',
  'دَفْتَرِ',
  'البَحْثِ',
  'العِلْمِيِّ',
  'بِحَمَاسٍ',
  'شَدِيدٍ،',
  'وَتَمَنَّى',
  'كُلُّ',
  'طَالِبٍ',
  'أَنْ',
  'يَقْرَأَ',
  'كُتُباً',
  'جَدِيدَةً',
  'عَنْ',
  'عَالَمِ',
  'الفَضَاءِ',
  'الوَاسِعِ.',
];

const G4_OASIS_WORDS = [
  'تتميزُ',
  'الواحاتُ',
  'العربيةُ',
  'بنظامِ',
  'ريٍّ',
  'عريقٍ',
  'يُعرفُ',
  'باسمِ',
  'الأفلاجِ',
  'المائيةِ.',
  'تنسابُ',
  'المياهُ',
  'العذبةُ',
  'منَ',
  'الينابيعِ',
  'الجبليةِ',
  'عبرَ',
  'قنواتٍ',
  'متصلةٍ',
  'لترْويَ',
  'بساتينَ',
  'النخيلِ',
  'والحقولَ',
  'الخضراءَ.',
  'حفرَ',
  'الأجدادُ',
  'هذهِ',
  'القنواتِ',
  'تحتَ',
  'الأرضِ',
  'لحمايةِ',
  'الماءِ',
  'منَ',
  'التبخرِ',
  'في',
  'أيامِ',
  'الصيفِ',
  'الحارةِ.',
  'يتعاونُ',
  'المزارعونَ',
  'يومياً',
  'لتوزيعِ',
  'حصصِ',
  'المياهِ',
  'بالعدلِ',
  'والدقةِ',
  'بينَ',
  'جميعِ',
  'المزارعِ،',
  'فتظلُّ',
  'الواحةُ',
  'عامرةً',
  'بالثمارِ',
  'والظلالِ',
  'الوارفةِ',
  'طوالَ',
  'العامِ.',
];

const G4_WATER_WORDS = [
  'في',
  'صباحٍ',
  'هادئٍ',
  'اجتمعَ',
  'أهلُ',
  'القريةِ',
  'حولَ',
  'ساقيةِ',
  'الماءِ',
  'القديمةِ.',
  'تدورُ',
  'عجلةُ',
  'الساقيةِ',
  'الخشبيةُ',
  'بانتظامٍ',
  'لترفعَ',
  'الماءَ',
  'منَ',
  'النهرِ',
  'إلى',
  'جداولِ',
  'الحقولِ',
  'المجاورةِ.',
  'تَفقَّدَ',
  'الفلاحُ',
  'محصولَ',
  'القمحِ',
  'الذهبيِّ،',
  'واطمأنَّ',
  'إلى',
  'وصولِ',
  'الماءِ',
  'لكلِّ',
  'نبْتةٍ',
  'صغيرةٍ',
  'قبلَ',
  'حلولِ',
  'الظهيرةِ.',
  'شاركهُ',
  'الأبناءُ',
  'في',
  'تنظيفِ',
  'المجرى',
  'المائيِّ',
  'منَ',
  'الأوراقِ',
  'المتساقطةِ',
  'حتى',
  'يتدفقَ',
  'الماءُ',
  'بسهولةٍ',
  'ويعمَّ',
  'الخيرُ',
  'أرجاءَ',
  'القريةِ.',
];

const G5_SOLAR_WORDS = [
  'تشهدُ',
  'المدنُ',
  'العربيةُ',
  'توسعاً',
  'كبيراً',
  'في',
  'استخدامِ',
  'الطاقةِ',
  'الشمسيةِ',
  'النظيفةِ.',
  'تستقبلُ',
  'الألواحُ',
  'الشمسيةُ',
  'المثبتةُ',
  'فوقَ',
  'أسطحِ',
  'المدارسِ',
  'والمنازلِ',
  'أشعةَ',
  'الشمسِ',
  'الساطعةَ',
  'طوالَ',
  'النهارِ،',
  'ثمَّ',
  'تحوّلُها',
  'إلى',
  'كهرباءَ',
  'تُضيءُ',
  'الفصولَ',
  'الدراسيةَ',
  'وتشغّلُ',
  'الأجهزةَ',
  'التعليميةَ.',
  'تُخزَّنُ',
  'الطاقةُ',
  'الفائضةُ',
  'في',
  'بطارياتٍ',
  'حديثةٍ',
  'ليستفيدَ',
  'منها',
  'الناسُ',
  'بعدَ',
  'غروبِ',
  'الشمسِ.',
  'وبفضلِ',
  'هذا',
  'الابتكارِ',
  'المتجددِ،',
  'ينخفضُ',
  'تلوثُ',
  'الهواءِ',
  'وتبقى',
  'البيئةُ',
  'صحيةً',
  'وآمنةً',
  'للأجيالِ',
  'القادمةِ.',
];

const G6_LIBRARY_WORDS = [
  'تعد',
  'صناعة',
  'الورق',
  'من',
  'أهم',
  'الابتكارات',
  'التي',
  'أسهمت',
  'في',
  'نشر',
  'المعرفة',
  'وحفظ',
  'العلوم',
  'عبر',
  'العصور.',
  'قبل',
  'انتشار',
  'الورق،',
  'كان',
  'الناس',
  'يدونون',
  'رسائلهم',
  'على',
  'ورق',
  'البردي',
  'أو',
  'الجلود',
  'الثقيلة',
  'التي',
  'يصعب',
  'حملها',
  'ونقلها',
  'بين',
  'البلدان.',
  'وعندما',
  'أنشئت',
  'مصانع',
  'الورق',
  'في',
  'الحواضر',
  'العربية',
  'القديمة،',
  'ازدهرت',
  'حركة',
  'التأليف',
  'والترجمة',
  'ونشأت',
  'المكتبات',
  'الكبرى.',
  'واليوم',
  'تجمع',
  'مكتبة',
  'المدرسة',
  'بين',
  'الكتب',
  'الورقية',
  'المطبوعة',
  'والمنصات',
  'الرقمية',
  'الحديثة',
  'لتيسير',
  'البحث',
  'والقراءة',
  'لكل',
  'طالب.',
];

const PASSAGE_G1_GARDEN_WORDS = [
  "فِي",
  "صَبَاحٍ",
  "جَمِيلٍ،",
  "خَرَجَتْ",
  "لَيْلَى",
  "مَعَ",
  "أُمِّهَا",
  "إِلَى",
  "الْحَدِيقَةِ.",
  "سَارَتْ",
  "مَعَ",
  "أُمِّهَا",
  "بَيْنَ",
  "الزُّهُورِ",
  "وَشَمَّتْ",
  "رَائِحَةَ",
  "الْوَرْدِ",
  "الْعَطِرَةِ.",
  "رَأَتْ",
  "زَهْرَةً",
  "صَفْرَاءَ",
  "وَفَرَاشَةً",
  "صَغِيرَةً.",
  "سَقَتْ",
  "أُمُّهَا",
  "الزَّهْرَةَ",
  "بِقَلِيلٍ",
  "مِنَ",
  "الْمَاءِ.",
  "جَلَسَتْ",
  "لَيْلَى",
  "تَرْسُمُ",
  "الْفَرَاشَةَ",
  "فِي",
  "دَفْتَرِهَا",
  "فَرِحَةً.",
  "عِنْدَمَا",
  "عَادَتْ",
  "إِلَى",
  "الْبَيْتِ،",
  "وَضَعَتِ",
  "الرَّسْمَ",
  "عَلَى",
  "الطَّاوِلَةِ،",
  "وَشَكَرَتْ",
  "أُمَّهَا",
  "عَلَى",
  "رِفْقَتِهَا",
  "الْجَمِيلَةِ",
  "مَسْرُورَةً."
];

const PASSAGE_G1_SCHOOLBAG_WORDS = [
  "فِي",
  "الصَّبَاحِ،",
  "جَهَّزَ",
  "عُمَرُ",
  "حَقِيبَتَهُ",
  "لِلْمَدْرَسَةِ.",
  "وَضَعَ",
  "كِتَابًا",
  "وَدَفْتَرًا",
  "وَقَلَمًا",
  "أَزْرَقَ",
  "دَاخِلَهَا.",
  "بَحَثَ",
  "عَنْ",
  "مِمْحَاتِهِ",
  "فَوَجَدَهَا",
  "تَحْتَ",
  "السَّرِيرِ.",
  "سَاعَدَتْهُ",
  "أُخْتُهُ",
  "فِي",
  "تَرْتِيبِ",
  "الْأَدَوَاتِ،",
  "فَشَكَرَهَا",
  "عَلَى",
  "مُسَاعَدَتِهَا.",
  "تَأَكَّدَ",
  "عُمَرُ",
  "مِنْ",
  "أَنَّ",
  "كُتُبَهُ",
  "وَدَفَاتِرَهُ",
  "مُرَتَّبَةٌ،",
  "ثُمَّ",
  "ارْتَدَى",
  "حِذَاءَهُ،",
  "وَخَرَجَ",
  "مِنَ",
  "الْبَيْتِ",
  "وَهُوَ",
  "مُسْتَعِدٌّ",
  "لِيَوْمٍ",
  "جَدِيدٍ،",
  "وَأَغْلَقَ",
  "الْبَابَ",
  "بِهُدُوءٍ،",
  "وَانْطَلَقَ",
  "نَحْوَ",
  "مَدْرَسَتِهِ",
  "سَعِيدًا."
];

const PASSAGE_G2_RAIN_WORDS = [
  "اسْتَيْقَظَتْ",
  "مَرْيَمُ",
  "عَلَى",
  "صَوْتِ",
  "الْمَطَرِ",
  "أَمَامَ",
  "النَّافِذَةِ.",
  "لَبِسَتْ",
  "مِعْطَفَهَا",
  "وَحَمَلَتْ",
  "مِظَلَّتَهَا",
  "قَبْلَ",
  "الذَّهَابِ",
  "إِلَى",
  "الْمَدْرَسَةِ.",
  "فِي",
  "الطَّرِيقِ،",
  "رَأَتْ",
  "مَاءً",
  "يَتَجَمَّعُ",
  "عِنْدَ",
  "الرَّصِيفِ،",
  "فَاخْتَارَتْ",
  "مَسَارًا",
  "جَافًّا.",
  "وَصَلَتْ",
  "مُبَكِّرَةً،",
  "وَشَرَحَتْ",
  "لِزُمَلَائِهَا",
  "كَيْفَ",
  "سَاعَدَتْهَا",
  "الْمِظَلَّةُ",
  "عَلَى",
  "الْبَقَاءِ",
  "جَافَّةً.",
  "وَعِنْدَمَا",
  "تَوَقَّفَ",
  "الْمَطَرُ",
  "ظُهْرًا",
  "شَاهَدَتْ",
  "مَرْيَمُ",
  "الْعُمَّالَ",
  "وَهُمْ",
  "يُنَظِّفُونَ",
  "مَجْرَى",
  "الْمَاءِ",
  "مِنَ",
  "الْأَوْرَاقِ",
  "الْمُتَسَاقِطَةِ",
  "بِإِتْقَانٍ."
];

const PASSAGE_G5_WATER_WORDS = [
  "لاحظَ",
  "طلابُ",
  "الصفِّ",
  "الخامسِ",
  "أنَّ",
  "صنبورًا",
  "في",
  "ساحةِ",
  "المدرسةِ",
  "يظلُّ",
  "مفتوحًا",
  "بعدَ",
  "انتهاءِ",
  "الاستعمالِ.",
  "اقترحوا",
  "وضعَ",
  "ملصقٍ",
  "يذكِّرُ",
  "الجميعَ",
  "بإغلاقِ",
  "الصنابيرِ،",
  "وفحصِ",
  "التسرباتِ",
  "كلَّ",
  "أسبوعٍ.",
  "كما",
  "جمعوا",
  "ماءَ",
  "غسلِ",
  "الفواكهِ",
  "في",
  "وعاءٍ",
  "لاستخدامِه",
  "في",
  "ريِّ",
  "النباتاتِ",
  "غيرِ",
  "المثمرةِ.",
  "شرحَ",
  "المرشدُ",
  "أنَّ",
  "ترشيدَ",
  "الماءِ",
  "لا",
  "يعتمدُ",
  "على",
  "إجراءٍ",
  "واحدٍ،",
  "بل",
  "على",
  "عاداتٍ",
  "يوميةٍ",
  "ومتابعةٍ",
  "منتظمةٍ.",
  "وبعدَ",
  "شهرٍ،",
  "سجّلَ",
  "الطلابُ",
  "عددَ",
  "مراتِ",
  "العثورِ",
  "على",
  "صنبورٍ",
  "مفتوحٍ،",
  "وقارنوا",
  "الملاحظاتِ",
  "بالأسبوعِ",
  "الأولِ.",
  "ساعدَهم",
  "التسجيلُ",
  "على",
  "معرفةِ",
  "ما",
  "تحسّنَ",
  "وما",
  "يحتاجُ",
  "إلى",
  "متابعةٍ",
  "إضافيةٍ."
];

const PASSAGE_G6_LOCAL_HISTORY_WORDS = [
  "قررت",
  "مجموعة",
  "من",
  "الطلاب",
  "تسجيل",
  "حكايات",
  "كبار",
  "السن",
  "في",
  "الحي",
  "قبل",
  "أن",
  "تضيع",
  "تفاصيلها.",
  "أعدوا",
  "أسئلة",
  "عن",
  "المهن",
  "القديمة",
  "والأسواق",
  "وطرق",
  "السفر،",
  "ثم",
  "طلبوا",
  "الإذن",
  "قبل",
  "تسجيل",
  "المقابلات.",
  "بعد",
  "ذلك،",
  "راجعوا",
  "الأسماء",
  "والتواريخ",
  "مع",
  "أصحاب",
  "الحكايات،",
  "وقارنوا",
  "الروايات",
  "بالمصادر",
  "المكتوبة",
  "المتاحة",
  "في",
  "المكتبة.",
  "لم",
  "يتفق",
  "الراويان",
  "دائمًا",
  "على",
  "التفاصيل",
  "نفسها،",
  "فدوّن",
  "الطلاب",
  "مواضع",
  "الاختلاف",
  "بدل",
  "اختيار",
  "رواية",
  "من",
  "دون",
  "دليل.",
  "وفي",
  "نهاية",
  "المشروع،",
  "أنشؤوا",
  "أرشيفًا",
  "صغيرًا",
  "يضم",
  "النصوص",
  "والتسجيلات",
  "بموافقة",
  "أصحابها،",
  "ليستخدمه",
  "طلاب",
  "آخرون",
  "في",
  "دراسة",
  "تاريخ",
  "الحي."
];

export const ARABIC_READING_PASSAGES: ReadingPassage[] = [
  {
    id: 'passage-g2-garden',
    title: 'الْقِطَّةُ الْبَيْضَاءُ فِي الْحَدِيقَةِ',
    gradeLevel: 2,
    gradeLabel: 'الصف الثاني الابتدائي',
    category: 'مفردات الحياة اليومية · الصف الثاني الابتدائي (تشكيل كامل)',
    diacriticLevel: 'full',
    diacriticLabelAr: 'مشكّل بالكامل (تأسيسي للصف الثاني)',
    difficultyBand: 'foundational',
    wordCount: G2_GARDEN_WORDS.length,
    targetSkillsAr: [
      'التمييز بين الحروف المتشابهة نقطياً (ب / ت / ث، ج / ح / خ)',
      'قراءة المدود الثلاثة (الألف والواو والياء) مع الحركات القصيرة',
      'المفردات المألوفة في الحياة اليومية للطفل العربي',
    ],
    words: G2_GARDEN_WORDS,
    comprehensionQuestions: [
      {
        question: 'أَيْنَ كَانَتْ تَجْلِسُ الْقِطَّةُ الْبَيْضَاءُ عِنْدَمَا شَاهَدَتْهَا سَلْمَى؟',
        options: ['فَوْقَ سَطْحِ الْبَيْتِ', 'تَحْتَ شَجَرَةِ التُّفَّاحِ', 'دَاخِلَ غُرْفَةِ الضُّيُوفِ'],
        correctIndex: 1,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'أَيُّ تَصَرُّفٍ يُظْهِرُ عَطْفَ سَلْمَى عَلَى الْقِطَّةِ؟',
        options: ['تَرَكَتْهَا وَحْدَهَا فِي الْحَدِيقَةِ', 'أَبْعَدَتِ الْكُرَةَ عَنِ الزُّهُورِ', 'قَدَّمَتْ لَهَا الْمَاءَ وَالطَّعَامَ'],
        correctIndex: 2,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'مَا مَعْنَى كَلِمَةِ «عَذْبٌ» فِي جُمْلَةِ «فِيهِ مَاءٌ عَذْبٌ»؟',
        options: ['صَافٍ وَصَالِحٌ لِلشُّرْبِ', 'مَالِحٌ مِثْلَ الْبَحْرِ', 'مُتَجَمِّدٌ مِثْلَ الثَّلْجِ'],
        correctIndex: 0,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'مَا الْفِكْرَةُ الرَّئِيسَةُ الَّتِي تَدُورُ حَوْلَهَا هَذِهِ الْقِصَّةُ؟',
        options: ['زِرَاعَةُ الْأَشْجَارِ', 'اللَّعِبُ فِي الْمَلْعَبِ', 'الرِّفْقُ بِالْحَيَوَانِ'],
        correctIndex: 2,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g3-market',
    title: 'صَبَاحٌ فِي سُوقِ الْفَاكِهَةِ',
    gradeLevel: 3,
    gradeLabel: 'الصف الثالث الابتدائي',
    category: 'قصة اجتماعية متدرجة · الصف الثالث الابتدائي (تشكيل كامل)',
    diacriticLevel: 'full',
    diacriticLabelAr: 'مشكّل بالكامل (متدرج للصف الثالث)',
    difficultyBand: 'foundational',
    wordCount: G3_MARKET_WORDS.length,
    targetSkillsAr: [
      'الطلاقة القرائية في الجمل السردية المترابطة',
      'قراءة التنوين بالضم والفتح والكسر في أواخر الكلمات',
      'التفريق بين الحروف المتقاربة مخرجاً (س / ص، ت / ط، د / ض)',
    ],
    words: G3_MARKET_WORDS,
    comprehensionQuestions: [
      {
        question: 'بِمَاذَا وَزَنَ الْبَائِعُ الْفَاكِهَةَ فِي السُّوقِ؟',
        options: ['بِمِيزَانِهِ الدَّقِيقِ', 'بِصُنْدُوقِ الْخَشَبِ', 'بِالْعَدِّ السَّرِيعِ'],
        correctIndex: 0,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'أَيُّ سُلُوكٍ يُفَسِّرُ حُصُولَ طَارِقٍ عَلَى تُفَّاحَةٍ إِضَافِيَّةٍ؟',
        options: ['لِأَنَّهُ وَزَنَ الْفَاكِهَةَ بِسُرْعَةٍ', 'لِأَنَّهُ سَاعَدَ وَالِدَهُ فِي التَّسَوُّقِ', 'لِأَنَّ الْبَائِعَ كَانَ يُغْلِقُ مَتْجَرَهُ'],
        correctIndex: 1,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'مَا مَعْنَى كَلِمَةِ «الزَّكِيَّةُ» فِي جُمْلَةِ «تَفُوحُ مِنْهُ رَائِحَةُ الْفَوَاكِهِ الزَّكِيَّةُ»؟',
        options: ['بَعِيدَةٌ وَمَخْفِيَّةٌ', 'ثَقِيلَةٌ وَمُزْعِجَةٌ', 'طَيِّبَةُ الرَّائِحَةِ'],
        correctIndex: 2,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'مَا الْفِكْرَةُ الرَّئِيسَةُ لِقِصَّةِ «صَبَاحٌ فِي سُوقِ الْفَاكِهَةِ»؟',
        options: ['صِنَاعَةُ السِّلَالِ', 'التَّعَاوُنُ أَثْنَاءَ التَّسَوُّقِ', 'إِغْلَاقُ الْمَتَاجِرِ مَسَاءً'],
        correctIndex: 1,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g3-astronomy',
    title: 'رِحْلَةٌ إِلَى المَرْصَدِ الفَلَكِيِّ',
    gradeLevel: 3,
    gradeLabel: 'الصف الثالث الابتدائي (متقدم)',
    category: 'علوم وفلك · الصف الثالث الابتدائي (تشكيل كامل)',
    diacriticLevel: 'full',
    diacriticLabelAr: 'مشكّل بالكامل (نصوص علمية مبسّطة)',
    difficultyBand: 'intermediate',
    wordCount: G3_ASTRONOMY_WORDS.length,
    targetSkillsAr: [
      'قراءة الكلمات المتصلة بالسوابق واللواحق (لِمُشَاهَدَةِ، مُلَاحَظَاتِهِمْ)',
      'التمييز بين حرفي الظاء والضاد (المِنْظَارَ / المُضِيئَةِ)',
      'فهم الجمل العلمية المركبة واستخلاص الفكرة الرئيسة',
    ],
    words: G3_ASTRONOMY_WORDS,
    comprehensionQuestions: [
      {
        question: 'مَا الكَوْكَبُ الَّذِي ظَهَرَتْ حَلَقَاتُهُ الوَاضِحَةُ فِي المِنْظَارِ؟',
        options: ['كَوْكَبُ الْمِرِّيخِ', 'كَوْكَبُ عُطَارِدَ', 'كَوْكَبُ زُحَلَ'],
        correctIndex: 2,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'مَا الَّذِي سَاعَدَ الطُّلَّابَ عَلَى رُؤْيَةِ حَلَقَاتِ زُحَلَ بِوُضُوحٍ؟',
        options: ['صَفَاءُ السَّمَاءِ وَاسْتِخْدَامُ الْمِنْظَارِ', 'زِيَارَةُ الْمَرْصَدِ وَقْتَ الظَّهِيرَةِ', 'مُشَاهَدَةُ خَرَائِطَ الْمَدِينَةِ فَقَطْ'],
        correctIndex: 0,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'مَا المَقْصُودُ بِكَلِمَةِ «المِنْظَارَ» فِي النَّصِّ؟',
        options: ['مِصْبَاحٌ كَهْرَبَائِيٌّ لِلْغُرْفَةِ', 'أَدَاةٌ تُقَرِّبُ الْأَجْسَامَ الْبَعِيدَةَ', 'كِتَابٌ لِلْخَرَائِطِ'],
        correctIndex: 1,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'مَا الفِكْرَةُ الرَّئِيسَةُ لِهَذَا النَّصِّ؟',
        options: ['زِيَارَةُ الْمَرْصَدِ وَمُشَاهَدَةُ الْكَوَاكِبِ', 'صِنَاعَةُ الدَّفَاتِرِ الْمَدْرَسِيَّةِ', 'تَعَاقُبُ الْفُصُولِ الْأَرْبَعَةِ'],
        correctIndex: 0,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g4-oasis',
    title: 'واحةُ النخيلِ والقنواتُ المائيةُ',
    gradeLevel: 4,
    gradeLabel: 'الصف الرابع الابتدائي',
    category: 'بيئة وتراث · الصف الرابع الابتدائي (تشكيل جزئي وظيفي)',
    diacriticLevel: 'partial',
    diacriticLabelAr: 'مشكّل جزئياً (ضبط أواخر الكلمات واللبس)',
    difficultyBand: 'intermediate',
    wordCount: G4_OASIS_WORDS.length,
    targetSkillsAr: [
      'القراءة بتشكيل جزئي يضبط أواخر الكلمات ومواضع اللبس',
      'قراءة الجموع (جمع التكسير وجمع المؤنث السالم وجمع المذكر السالم)',
      'فهم المفردات البيئية من السياق',
    ],
    words: G4_OASIS_WORDS,
    comprehensionQuestions: [
      {
        question: 'ما اسمُ نظامِ الريِّ الذي ينقلُ المياهَ في الواحةِ؟',
        options: ['السُّدُودُ الرَّمْلِيَّةُ', 'الْأَفْلَاجُ', 'الصَّهَارِيجُ الْمَعْدِنِيَّةُ'],
        correctIndex: 1,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'إِذَا تَعَطَّلَتْ قَنَوَاتُ الْأَفْلَاجِ، فَمَا الْأَثَرُ الْأَقْرَبُ عَلَى الْوَاحَةِ؟',
        options: ['تَتَحَسَّنُ زِرَاعَةُ النَّخِيلِ بِسُرْعَةٍ', 'تَتَوَقَّفُ التُّرْبَةُ عَنْ امْتِصَاصِ ضَوْءِ الشَّمْسِ', 'يَقِلُّ وُصُولُ الْمَاءِ إِلَى الْمَزَارِعِ وَالنَّخِيلِ'],
        correctIndex: 2,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'ما معنى كلمةِ «تنسابُ» في جملةِ «تنسابُ المياهُ العذبةُ عبرَ قنواتٍ متصلةٍ»؟',
        options: ['تَجْرِي بِهُدُوءٍ وَاسْتِمْرَارٍ', 'تَتَوَقَّفُ وَتَتَجَمَّدُ', 'تَتَبَخَّرُ فِي الْهَوَاءِ الْحَارِّ'],
        correctIndex: 0,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'ما الفكرةُ الرئيسةُ التي يتناولُها نصُّ «واحةُ النخيلِ والقنواتُ المائيةُ»؟',
        options: ['تَسَلُّقُ الْجِبَالِ شِتَاءً', 'أَهَمِّيَّةُ الْأَفْلَاجِ وَتَعَاوُنُ الْمُزَارِعِينَ', 'أَنْوَاعُ التُّمُورِ فِي الْأَسْوَاقِ الْمَحَلِّيَّةِ'],
        correctIndex: 1,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g4-partial-water',
    title: 'ساقيةُ القريةِ وحقولُ القمحِ',
    gradeLevel: 4,
    gradeLabel: 'الصف الرابع الابتدائي',
    category: 'تشكيل جزئي وظيفي · الصف الرابع الابتدائي',
    diacriticLevel: 'partial',
    diacriticLabelAr: 'مشكّل جزئياً (أواخر الكلمات وضبط اللبس)',
    difficultyBand: 'intermediate',
    wordCount: G4_WATER_WORDS.length,
    targetSkillsAr: [
      'القراءة بتشكيل جزئي يقتصر على أواخر الكلمات ومواضع اللبس',
      'استنتاج الحركات الداخلية للكلمات المألوفة من السياق النحوي',
      'مفردات عربية مشتركة ومألوفة في جميع البلدان العربية',
    ],
    words: G4_WATER_WORDS,
    comprehensionQuestions: [
      {
        question: 'ما وظيفةُ عجلةِ الساقيةِ الخشبيةِ في القريةِ؟',
        options: ['طَحْنُ الْقَمْحِ إِلَى دَقِيقٍ', 'تَحْرِيكُ الْهَوَاءِ فِي الْحُقُولِ', 'رَفْعُ الْمَاءِ إِلَى الْجَدَاوِلِ'],
        correctIndex: 2,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'مَا الْمُشْكِلَةُ الْمُحْتَمَلَةُ إِذَا سَدَّتِ الْأَوْرَاقُ مَجْرَى السَّاقِيَةِ؟',
        options: ['قَدْ يَقِلُّ تَدَفُّقُ الْمَاءِ إِلَى النَّبَاتَاتِ', 'يَزْدَادُ الْمَحْصُولُ دُونَ حَاجَةٍ إِلَى رَيٍّ', 'تَتَحَوَّلُ السَّاقِيَةُ إِلَى أَدَاةٍ لِطَحْنِ الْقَمْحِ'],
        correctIndex: 0,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'ما معنى كلمةِ «تَفقَّدَ» في جملةِ «تَفقَّدَ الفلاحُ محصولَ القمحِ الذهبيِّ»؟',
        options: ['ضَلَّ الطَّرِيقَ إِلَى الْحَقْلِ', 'فَحَصَ الْمَحْصُولَ وَاطْمَأَنَّ عَلَيْهِ', 'جَمَعَ الْقَمْحَ وَبَاعَهُ بِالْمَدِينَةِ'],
        correctIndex: 1,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'ما الفكرةُ الرئيسةُ لنصِّ «ساقيةُ القريةِ وحقولُ القمحِ»؟',
        options: ['بِنَاءُ جُسُورٍ حَجَرِيَّةٍ فَوْقَ الْأَنْهَارِ', 'هِجْرَةُ الطُّيُورِ فِي بَدَايَةِ الْخَرِيفِ', 'تَعَاوُنُ أَهْلِ الْقَرْيَةِ فِي الرَّيِّ'],
        correctIndex: 2,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g5-solar',
    title: 'الطاقةُ الشمسيةُ في مدينتِنا',
    gradeLevel: 5,
    gradeLabel: 'الصف الخامس الابتدائي',
    category: 'علوم وتقنية حديثة · الصف الخامس الابتدائي (تشكيل جزئي وظيفي)',
    diacriticLevel: 'partial',
    diacriticLabelAr: 'مشكّل جزئياً (للصف الخامس الابتدائي)',
    difficultyBand: 'intermediate',
    wordCount: G5_SOLAR_WORDS.length,
    targetSkillsAr: [
      'قراءة النصوص العلمية للصف الخامس بتشكيل جزئي وظيفي',
      'معالجة الجمل المركبة المحتوية على روابط سببية وزمنية',
      'التمييز السريع بين الصيغ الصرفية للمضارع والمبني للمجهول (تستقبلُ / تُخزَّنُ)',
    ],
    words: G5_SOLAR_WORDS,
    comprehensionQuestions: [
      {
        question: 'أينَ تُثبَّتُ الألواحُ الشمسيةُ كما وردَ في النصِّ؟',
        options: ['فَوْقَ أَسْطُحِ الْمَدَارِسِ وَالْمَنَازِلِ', 'تَحْتَ مِيَاهِ الْأَنْهَارِ وَالْبِحَارِ', 'دَاخِلَ أَنْفَاقٍ أَرْضِيَّةٍ مُظْلِمَةٍ'],
        correctIndex: 0,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'أَيُّ احْتِيَاجٍ تُلَبِّيهِ الْبَطَّارِيَّاتُ فِي هَذَا النِّظَامِ؟',
        options: ['تَوْلِيدُ كَهْرَبَاءَ مِنْ ضَوْءِ الْقَمَرِ', 'زِيَادَةُ ضَوْءِ الشَّمْسِ بَعْدَ الْغُرُوبِ', 'اِسْتِخْدَامُ الطَّاقَةِ الْمُخَزَّنَةِ عِنْدَ غِيَابِ الشَّمْسِ'],
        correctIndex: 2,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'ما المقصودُ بكلمةِ «الفائضةُ» في جملةِ «تُخزَّنُ الطاقةُ الفائضةُ في بطارياتٍ حديثةٍ»؟',
        options: ['الطَّاقَةُ الضَّعِيفَةُ', 'الزَّائِدَةُ عَنْ حَاجَةِ النَّهَارِ', 'الطَّاقَةُ التَّالِفَةُ غَيْرُ الصَّالِحَةِ'],
        correctIndex: 1,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'ما الفكرةُ الرئيسةُ لنصِّ «الطاقةُ الشمسيةُ في مدينتِنا»؟',
        options: ['الْكَهْرَبَاءُ الشَّمْسِيَّةُ وَحِمَايَةُ الْبِيئَةِ', 'صِنَاعَةُ الزُّجَاجِ الْمُلَوَّنِ فِي الْمَصَانِعِ', 'جَدْوَلُ الْحِصَصِ الْمَدْرَسِيَّةِ الْيَوْمِيَّةِ'],
        correctIndex: 0,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g6-unvowelized-library',
    title: 'مكتبة المدرسة وصناعة الورق',
    gradeLevel: 6,
    gradeLabel: 'الصف السادس الابتدائي',
    category: 'نص غير مشكّل (قراءة سياقية) · الصف السادس الابتدائي',
    diacriticLevel: 'minimal',
    diacriticLabelAr: 'بدون تشكيل (قراءة سياقية للصف السادس)',
    difficultyBand: 'advanced',
    wordCount: G6_LIBRARY_WORDS.length,
    targetSkillsAr: [
      'قراءة النص العربي غير المشكّل بالاعتماد على الفهم السياقي والصرفي',
      'التمييز بين المشتركات اللفظية دون حركات قصيرة',
      'معالجة الجمل الطويلة واستخلاص العلاقات السببية والتاريخية',
    ],
    words: G6_LIBRARY_WORDS,
    comprehensionQuestions: [
      {
        question: 'علامَ كان الناس يدونون رسائلهم قبل انتشار صناعة الورق؟',
        options: ['عَلَى أَلْوَاحِ الزُّجَاجِ', 'عَلَى الْأَقْمِشَةِ الْحَرِيرِيَّةِ', 'عَلَى الْبَرْدِيِّ وَالْجُلُودِ'],
        correctIndex: 2,
        skillType: 'literal_recall',
        skillLabelAr: 'الاسترجاع المباشر',
      },
      {
        question: 'لماذا أسهم انتشار مصانع الورق في ازدهار حركة التأليف والترجمة؟',
        options: ['لِأَنَّ الْجِلْدَ كَانَ أَرْخَصَ', 'لِأَنَّ الْوَرَقَ أَخَفُّ وَأَسْهَلُ حَمْلًا', 'لِأَنَّ الْمَكَاتِبَ مَنَعَتِ الِاسْتِعَارَةَ'],
        correctIndex: 1,
        skillType: 'inferential',
        skillLabelAr: 'الفهم الضمني والاستنتاج',
      },
      {
        question: 'ما معنى كلمة «يدونون» في سياق جملة «كان الناس يدونون رسائلهم»؟',
        options: ['يَكْتُبُونَ وَيُسَجِّلُونَ', 'يَقْرَؤُونَ بِصَوْتٍ مُرْتَفِعٍ', 'يُرْسِلُونَ عَبْرَ الْهَوَاتِفِ'],
        correctIndex: 0,
        skillType: 'vocabulary_context',
        skillLabelAr: 'المفردات في السياق',
      },
      {
        question: 'ما الفكرة الرئيسة لنص «مكتبة المدرسة وصناعة الورق»؟',
        options: ['قَوَاعِدُ اسْتِعَارَةِ الْأَجْهِزَةِ الْمَدْرَسِيَّةِ', 'تَطَوُّرُ وَسَائِلِ الْكِتَابَةِ وَحِفْظِ الْمَعْرِفَةِ', 'صِنَاعَةُ الْجُلُودِ فِي الْعُصُورِ الْقَدِيمَةِ'],
        correctIndex: 1,
        skillType: 'main_idea',
        skillLabelAr: 'الفكرة الرئيسة',
      },
    ],
  },
  {
    id: 'passage-g1-garden', title: 'زَهْرَةُ لَيْلَى', gradeLevel: 1, gradeLabel: 'الصف الأول الابتدائي', category: 'قصة قصيرة من الحياة اليومية',
    diacriticLevel: 'full', diacriticLabelAr: 'مشكّل بالكامل', difficultyBand: 'foundational',
    wordCount: PASSAGE_G1_GARDEN_WORDS.length, targetSkillsAr: ["قراءة الجمل القصيرة","مفردات من البيئة المحيطة","تحديد تسلسل الأحداث"], words: PASSAGE_G1_GARDEN_WORDS,
    comprehensionQuestions: [
      { question: 'إلى أين ذهبت ليلى مع أمها؟', options: ['إلى الحديقة', 'إلى السوق', 'إلى المكتبة'], correctIndex: 0, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'ماذا فعلت الأم للزهرة؟', options: ['قطفت أوراقها', 'سقتها بالماء', 'وضعتها في صندوق'], correctIndex: 1, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'لماذا أحضرت الأم الماء؟', options: ['لتنظيف الدفتر', 'لرسم الفراشة', 'لتسقي الزهرة'], correctIndex: 2, skillType: 'inferential', skillLabelAr: 'فهم العلاقة بين الحدث والسبب' },
      { question: 'ماذا فعلت ليلى بعد عودتها؟', options: ['وَضَعَتِ الرَّسْمَ عَلَى الطَّاوِلَةِ', 'نَامَتْ فِي الْحَدِيقَةِ', 'ذَهَبَتْ إِلَى السُّوقِ'], correctIndex: 0, skillType: 'literal_recall', skillLabelAr: 'تسلسل الأحداث' },
    ],
  },
  {
    id: 'passage-g1-schoolbag', title: 'حَقِيبَةُ عُمَرَ', gradeLevel: 1, gradeLabel: 'الصف الأول الابتدائي', category: 'قصة مدرسية قصيرة',
    diacriticLevel: 'full', diacriticLabelAr: 'مشكّل بالكامل', difficultyBand: 'foundational',
    wordCount: PASSAGE_G1_SCHOOLBAG_WORDS.length, targetSkillsAr: ["مفردات المدرسة","ترتيب المعلومات","قراءة الجمل المترابطة"], words: PASSAGE_G1_SCHOOLBAG_WORDS,
    comprehensionQuestions: [
      { question: 'ما اللون الذي كان عليه قلم عمر؟', options: ['أخضر', 'أحمر', 'أزرق'], correctIndex: 2, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'أين وجد عمر الممحاة؟', options: ['تحت السرير', 'داخل الحقيبة', 'فوق المكتب'], correctIndex: 0, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'من ساعد عمر في ترتيب الأدوات؟', options: ['صديقه', 'أخته', 'زميله'], correctIndex: 1, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'لماذا جهز عمر حقيبته؟', options: ['ليذهب إلى السوق', 'ليزور الحديقة', 'ليستعد للمدرسة'], correctIndex: 2, skillType: 'inferential', skillLabelAr: 'استنتاج من السياق' },
    ],
  },
  {
    id: 'passage-g2-rain', title: 'المَطَرُ فِي الحَيِّ', gradeLevel: 2, gradeLabel: 'الصف الثاني الابتدائي', category: 'قصة عن الطقس والحي',
    diacriticLevel: 'full', diacriticLabelAr: 'مشكّل بالكامل', difficultyBand: 'foundational',
    wordCount: PASSAGE_G2_RAIN_WORDS.length, targetSkillsAr: ["فهم السبب والنتيجة","مفردات الطقس","استخلاص الفكرة"], words: PASSAGE_G2_RAIN_WORDS,
    comprehensionQuestions: [
      { question: 'ما الذي حملته مريم قبل الخروج؟', options: ['حقيبة رياضة', 'مظلة', 'كرة صغيرة'], correctIndex: 1, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'لماذا اختارت مريم مسارًا جافًا؟', options: ['لتجنب البرك', 'لتصل إلى متجر قريب', 'لتبحث عن صديقتها'], correctIndex: 0, skillType: 'inferential', skillLabelAr: 'استنتاج من النص' },
      { question: 'ما فائدة المظلة في القصة؟', options: ['جعلت الطريق أقصر', 'منعت صوت المطر', 'أبقتها جافة'], correctIndex: 2, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'ما الفكرة الرئيسة للنص؟', options: ['الاستعداد للمطر أثناء الذهاب إلى المدرسة', 'كيفية صنع معطف جديد', 'ألعاب الأطفال في يوم مشمس'], correctIndex: 0, skillType: 'main_idea', skillLabelAr: 'الفكرة الرئيسة' },
    ],
  },
  {
    id: 'passage-g5-water', title: 'إدارة الماء في المدرسة', gradeLevel: 5, gradeLabel: 'الصف الخامس الابتدائي', category: 'نص علمي بيئي',
    diacriticLevel: 'partial', diacriticLabelAr: 'مشكّل جزئيًا', difficultyBand: 'intermediate',
    wordCount: PASSAGE_G5_WATER_WORDS.length, targetSkillsAr: ["تحديد السبب والنتيجة","قراءة نص معلوماتي","استخلاص الغرض من البيانات"], words: PASSAGE_G5_WATER_WORDS,
    comprehensionQuestions: [
      { question: 'ما المشكلة التي لاحظها الطلاب؟', options: ['صنبور مفتوح', 'نقص الملصقات في الصفوف', 'تأخر الحافلة عن المدرسة'], correctIndex: 0, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'لماذا سجل الطلاب الملاحظات أسبوعيًا؟', options: ['ليحسبوا درجات الرياضيات', 'لمتابعة التحسن', 'ليختاروا نباتات جديدة فقط'], correctIndex: 1, skillType: 'inferential', skillLabelAr: 'استنتاج من النص' },
      { question: 'كيف أعاد الطلاب استخدام بعض الماء؟', options: ['غسلوا به الكتب المدرسية', 'خزنوه للشرب لاحقًا', 'استخدموه في ري النباتات'], correctIndex: 2, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'أي استنتاج تدعمه القصة؟', options: ['المتابعة تكشف التحسن', 'ملصق واحد يحل كل المشكلات', 'الماء لا يحتاج إلى ترشيد'], correctIndex: 0, skillType: 'inferential', skillLabelAr: 'استنتاج مدعوم بالأدلة' },
    ],
  },
  {
    id: 'passage-g6-local-history', title: 'حفظ الحكايات المحلية', gradeLevel: 6, gradeLabel: 'الصف السادس الابتدائي', category: 'نص معلوماتي عن الذاكرة المجتمعية',
    diacriticLevel: 'minimal', diacriticLabelAr: 'بدون تشكيل', difficultyBand: 'advanced',
    wordCount: PASSAGE_G6_LOCAL_HISTORY_WORDS.length, targetSkillsAr: ["تقييم الأدلة","تلخيص نص معلوماتي","تمييز الحقيقة عن الاختلاف في الروايات"], words: PASSAGE_G6_LOCAL_HISTORY_WORDS,
    comprehensionQuestions: [
      { question: 'ما الفائدة التي يحققها الأرشيف للطلاب لاحقًا؟', options: ['ليتمكن طلاب آخرون من دراسة تاريخ الحي', 'لاختيار فائز في مسابقة', 'لإعداد إعلان عن السوق'], correctIndex: 0, skillType: 'inferential', skillLabelAr: 'استنتاج من النص' },
      { question: 'ماذا فعل الطلاب عندما اختلفت روايتان؟', options: ['حذفوا المقابلتين', 'سجلوا مواضع الاختلاف', 'اختاروا الرواية الأطول'], correctIndex: 1, skillType: 'literal_recall', skillLabelAr: 'استرجاع مباشر' },
      { question: 'أي مبدأ اتبعه الطلاب عندما اختلفت الروايات؟', options: ['اختيار الرواية الأطول', 'تجاهل الاختلاف بين الشهادات', 'الاعتماد على الدليل عند اختلاف الروايات'], correctIndex: 2, skillType: 'inferential', skillLabelAr: 'استنتاج من النص' },
      { question: 'أي ممارسة تدل على احترام المشاركين؟', options: ['طلب الإذن قبل التسجيل', 'نشر كل التسجيلات فورًا', 'حذف أسماء أصحاب الحكايات من سجلاتهم دون مراجعة'], correctIndex: 0, skillType: 'inferential', skillLabelAr: 'استنتاج أخلاقي من النص' },
    ],
  },
];

export const INITIAL_STUDENTS: StudentRecord[] = [
  {
    id: 'stu-guest',
    name: 'البطل الصغير',
    isDemoRecord: false,
    gradeLevel: 3,
    ageYears: 8,
    schoolName: 'مدرستي',
    lastScreenedDate: '—',
    passageId: 'passage-g3-astronomy',
    dialectRegionAr: 'اللهجة العامة المعيارية',
    guardianConsentGiven: false,
    wpm: 0,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'لم تبدأ جلسة الفحص بعد.',
    problematicWords: [],
    cognitiveResults: undefined,
    comprehensionScore: 0,
    dyscalculiaAssessed: false,
    subitizingAccuracy: 0,
    avgSubitizingMs: 0,
    numberLinePAE: 0,
    transcodingAccuracy: 0,
    reversalErrorCount: 0,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'لم تبدأ مهام الحساب بعد.',
    learningReport: {
      learningSummary: 'لم تبدأ جلسات التقييم بعد. تظهر هنا المؤشرات التربوية الاسترشادية بعد إكمال أول جلسة قراءة أو حساب.',
      ocularMotorAnalysis: 'غير منطبق؛ منصة بصيرة لا تعتمد على الكاميرا أو تتبع حركة العين.',
      orthographicAndPhonologicalPatterns: 'في انتظار بيانات القراءة الأولى لتحليل الأنماط الصوتية والإملائية.',
      dyscalculiaSpatialAnalysis: 'في انتظار بيانات مختبر الحساب لتحليل الإدراك المكاني للكميات وخط الأعداد.',
      interventionExercises: [
        {
          title: 'التهيئة القرائية اليومية',
          durationMinutes: 10,
          description: 'اختر نصاً قصيراً مشكولاً من مكتبة القراءة لتسجيل انطلاقة القراءة الأولى.',
        },
      ],
      classroomAccommodations: [
        'توفير بيئة هادئة ومحفزة عند بدء أنشطة القراءة والحساب.',
      ],
    },
  },
  {
    id: 'stu-rayan',
    name: 'ريان طلال العتيبي',
    isDemoRecord: true,
    gradeLevel: 3,
    ageYears: 9,
    schoolName: 'مدرسة الرواد الابتدائية',
    lastScreenedDate: '٢٠٢٦/١٠/١٩',
    passageId: 'passage-g3-astronomy',
    dialectRegionAr: 'اللهجة الخليجية / السعودية',
    guardianConsentGiven: false,
    wpm: 39,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'بيانات اصطناعية للتوضيح؛ لا تصنيف خطر معياري.',
    problematicWords: ['لِمُشَاهَدَةِ', 'الكَوَاكِبِ', 'المُضِيئَةِ', 'المِنْظَارَ', 'مُلَاحَظَاتِهِمْ'],
    cognitiveResults: {
      ranSpeedItemsPerSec: 1.15,
      ranDurationSeconds: 35,
      ranHesitationCount: 4,
      ranCategory: 'colors',
      ranStatus: 'unassessed',
      ranStatusLabelAr: 'بيانات تجريبية للتوضيح؛ لا توجد معايير عربية معيارية معتمدة في بصيرة.',
      pseudoWordScorePercent: 62,
      pseudoWordWordsRead: 5,
      pseudoWordTotalCount: 8,
      phonemicAwarenessScorePercent: 75,
      completedAt: '٢٠٢٦/١٠/١٩',
    },
    comprehensionScore: 50,
    dyscalculiaAssessed: true,
    subitizingAccuracy: 67,
    avgSubitizingMs: 1980,
    numberLinePAE: 18.4,
    transcodingAccuracy: 50,
    reversalErrorCount: 2,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'بيانات حساب اصطناعية للتوضيح؛ لا تصنيف خطر معتمد.',
    learningReport: {
      learningSummary:
        'حالة نموذجية اصطناعية لشرح شكل التقرير فقط. القيم المعروضة ليست بيانات طفل حقيقي، ولا تمثل مئينات معيارية أو تشخيصًا.',
      ocularMotorAnalysis:
        'غير منطبق؛ لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين ولا تجمع قياسات نظر.',
      orthographicAndPhonologicalPatterns:
        'لا يثبت هذا السجل الاصطناعي وجود صعوبة لغوية أو سلامة المهارات؛ الكلمات والقيم هنا أمثلة توضيحية فقط.',
      dyscalculiaSpatialAnalysis:
        'قيم المهام الحسابية اصطناعية لتوضيح شكل التقرير؛ لا تُفسر على أنها أداء طبيعي أو غير طبيعي أو درجة خطر.',
      interventionExercises: [
        {
          title: 'تفكيك الكلمات الطويلة بالمقاطع الملونة',
          durationMinutes: 12,
          description: 'استخدام القارئ الميسّر لتقسيم الكلمات متعددة المقاطع (مثل مُـ · لَا · حَـ · ظَا · تِـ · هِمْ) مع إبراز الكلمات بإيقاع بصري.',
        },
        {
          title: 'تدريب خط الأعداد المكاني الملموس (0 - 100)',
          durationMinutes: 10,
          description: 'ربط الكميات العشرية بمواقعها المرجعية (25، 50، 75) لتقليص الانحراف المكاني PAE.',
        },
        {
          title: 'تثبيت اتجاه ترميز الآحاد والعشرات بالعربية',
          durationMinutes: 8,
          description: 'تدريب بصري بلونين (الأزرق للآحاد والأخضر للعشرات) لمنع الانعكاس المكاني أثناء قراءة الأرقام.',
        },
      ],
      classroomAccommodations: [
        'يمكن تجربة مسطرة قراءة أو خلفية مختلفة إذا وجد الطفل أنها أكثر راحة؛ يختلف التفضيل بين الأطفال.',
        'اختيار نص قصير مناسب لمستوى القراءة الحالي، ثم زيادة الصعوبة تدريجياً وفق تحليل الذكاء الاصطناعي المستمر.',
        'استخدام شبكة المربعات المكانية عند إجراء العمليات الحسابية.',
      ],
    },
  },
  {
    id: 'stu-layla',
    name: 'ليلى سامي المنصور',
    isDemoRecord: true,
    gradeLevel: 3,
    ageYears: 9,
    schoolName: 'مدرسة الرواد الابتدائية',
    lastScreenedDate: '٢٠٢٦/١٠/١٩',
    passageId: 'passage-g3-astronomy',
    dialectRegionAr: 'اللهجة الشامية / الفصحى',
    guardianConsentGiven: false,
    wpm: 88,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'بيانات اصطناعية للتوضيح؛ لا تصنيف خطر معياري.',
    problematicWords: ['مُلَاحَظَاتِهِمْ'],
    comprehensionScore: 100,
    dyscalculiaAssessed: true,
    subitizingAccuracy: 60,
    avgSubitizingMs: 2150,
    numberLinePAE: 21.5,
    transcodingAccuracy: 50,
    reversalErrorCount: 2,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'بيانات حساب اصطناعية للتوضيح؛ لا تصنيف خطر معتمد.',
    learningReport: {
      learningSummary:
        'حالة نموذجية اصطناعية لشرح شكل التقرير فقط. القيم المعروضة ليست بيانات طفل حقيقي، ولا تمثل مئينات معيارية أو تشخيصًا.',
      ocularMotorAnalysis:
        'غير منطبق؛ لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين ولا تجمع قياسات نظر.',
      orthographicAndPhonologicalPatterns:
        'لا يثبت هذا السجل الاصطناعي وجود صعوبة لغوية أو سلامة المهارات؛ الكلمات والقيم هنا أمثلة توضيحية فقط.',
      dyscalculiaSpatialAnalysis:
        'قيم المهام الحسابية اصطناعية لتوضيح شكل التقرير؛ لا تُفسر على أنها أداء طبيعي أو غير طبيعي أو درجة خطر.',
      interventionExercises: [
        {
          title: 'تدريب الإدراك الكمي السريع (Subitizing Flash)',
          durationMinutes: 10,
          description: 'عرض أنماط نقطية منتظمة وعشوائية (3 إلى 7 نقاط) لتعزيز الحس الكمي المباشر دون عدّ فردي بطيء.',
        },
        {
          title: 'معايرة خط الأعداد الذهني (0-100)',
          durationMinutes: 12,
          description: 'تمارين تفاعلية لتحديد نقاط الارتكاز المكانية (10، 25، 50، 75) وربطها بحجم الكمية.',
        },
      ],
      classroomAccommodations: [
        'الاعتماد على الشرح اللفظي والقصصي للمفاهيم الرياضية للاستفادة من طلاقتها القرائية.',
        'توفير خط أعداد مرئي على مكتب الطالبة أثناء حل المسائل.',
      ],
    },
  },
  {
    id: 'stu-omar',
    name: 'عمر خالد الدوسري',
    isDemoRecord: true,
    gradeLevel: 4,
    ageYears: 10,
    schoolName: 'مدرسة الرواد الابتدائية',
    lastScreenedDate: '٢٠٢٦/١٠/١٩',
    passageId: 'passage-g4-oasis',
    dialectRegionAr: 'اللهجة المصرية / الخليجية',
    guardianConsentGiven: false,
    wpm: 64,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'بيانات اصطناعية للتوضيح؛ لا تصنيف خطر معياري.',
    problematicWords: ['تتميزُ', 'الأفلاجِ', 'الينابيعِ', 'الوارفةِ'],
    comprehensionScore: 100,
    dyscalculiaAssessed: true,
    subitizingAccuracy: 83,
    avgSubitizingMs: 1290,
    numberLinePAE: 8.2,
    transcodingAccuracy: 100,
    reversalErrorCount: 0,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'بيانات حساب اصطناعية للتوضيح؛ لا تصنيف خطر معتمد.',
    learningReport: {
      learningSummary:
        'حالة نموذجية اصطناعية لشرح شكل التقرير فقط. القيم المعروضة ليست بيانات طفل حقيقي، ولا تمثل مئينات معيارية أو تشخيصًا.',
      ocularMotorAnalysis:
        'غير منطبق؛ لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين ولا تجمع قياسات نظر.',
      orthographicAndPhonologicalPatterns:
        'لا يثبت هذا السجل الاصطناعي وجود صعوبة لغوية أو سلامة المهارات؛ الكلمات والقيم هنا أمثلة توضيحية فقط.',
      dyscalculiaSpatialAnalysis:
        'قيم المهام الحسابية اصطناعية لتوضيح شكل التقرير؛ لا تُفسر على أنها أداء طبيعي أو غير طبيعي أو درجة خطر.',
      interventionExercises: [
        {
          title: 'القراءة المتدرجة بالتشكيل الجزئي الوظيفي',
          durationMinutes: 10,
          description: 'قراءة نص «ساقيةُ القريةِ وحقولُ القمحِ» (تشكيل جزئي) لتعزيز الطلاقة السياقية والتدرّب على النص وشرح المفردات وفق مستوى الطالب؛ لا تُستخدم سرعة مستهدفة غير متحققة معيارياً.',
        },
      ],
      classroomAccommodations: [
        'تقديم بطاقة تعريفية بالمفردات الجديدة قبل بدء قراءة النصوص التراثية أو العلمية.',
      ],
    },
  },
  {
    id: 'stu-sara',
    name: 'سارة فهد الزهراني',
    isDemoRecord: true,
    gradeLevel: 5,
    ageYears: 11,
    schoolName: 'مدرسة الرواد الابتدائية',
    lastScreenedDate: '٢٠٢٦/١٠/١٩',
    passageId: 'passage-g5-solar',
    dialectRegionAr: 'الفصحى المعيارية / الخليجية',
    guardianConsentGiven: false,
    wpm: 118,
    dyslexiaRiskScore: null,
    readingHeuristicIndicator: null,
    readingRiskLevel: 'unassessed',
    readingRiskLabelAr: 'بيانات اصطناعية للتوضيح؛ لا تصنيف خطر معياري.',
    problematicWords: [],
    comprehensionScore: 100,
    dyscalculiaAssessed: true,
    subitizingAccuracy: 100,
    avgSubitizingMs: 890,
    numberLinePAE: 3.8,
    transcodingAccuracy: 100,
    reversalErrorCount: 0,
    dyscalculiaRiskScore: null,
    mathHeuristicIndicator: null,
    mathRiskLevel: 'unassessed',
    mathRiskLabelAr: 'بيانات حساب اصطناعية للتوضيح؛ لا تصنيف خطر معتمد.',
    learningReport: {
      learningSummary:
        'حالة نموذجية اصطناعية لشرح شكل التقرير فقط. القيم المعروضة ليست بيانات طفل حقيقي، ولا تمثل مئينات معيارية أو تشخيصًا.',
      ocularMotorAnalysis:
        'غير منطبق؛ لا تستخدم بصيرة الحالية الكاميرا أو تتبّع العين ولا تجمع قياسات نظر.',
      orthographicAndPhonologicalPatterns:
        'لا يثبت هذا السجل الاصطناعي وجود صعوبة لغوية أو سلامة المهارات؛ الكلمات والقيم هنا أمثلة توضيحية فقط.',
      dyscalculiaSpatialAnalysis:
        'قيم المهام الحسابية اصطناعية لتوضيح شكل التقرير؛ لا تُفسر على أنها أداء طبيعي أو غير طبيعي أو درجة خطر.',
      interventionExercises: [
        {
          title: 'الانتقال إلى النصوص غير المشكّلة (الصف السادس)',
          durationMinutes: 10,
          description: 'قراءة نص «مكتبة المدرسة وصناعة الورق» غير المشكّل لتعزيز الاستنتاج النحوي وفك اللبس الصرفي من السياق.',
        },
      ],
      classroomAccommodations: [
        'إشراك الطالبة في أنشطة القراءة الإثرائية ومسابقات الرياضيات الذهنية.',
      ],
    },
  },
];
