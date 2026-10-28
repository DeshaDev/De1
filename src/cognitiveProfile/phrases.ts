/**
 * Every fixed phrase the games speak aloud. Keeping them in one place lets the audio
 * catalogue (audioCatalog.ts) list every clip that must be pre-recorded.
 */
export const PHRASES = {
  praise: ["أَحْسَنْتَ!", "رَائِعْ!", "مُمْتَازْ!"],
  wellDone: "أَحْسَنْتَ!",
  lookAnswer: "انْظُرْ، هَذَا هُوَ الجَوَابُ.",
  lookOrder: "انْظُرْ إِلَى التَّرْتِيبِ الصَّحِيحِ.",
  gameOver: "أَحْسَنْتَ! انْتَهَتِ اللُّعْبَةُ.",
  testStarts: "رَائِعْ! الآنَ نَبْدَأُ اللُّعْبَةَ. لَنْ أُخْبِرَكَ إِنْ كَانَتْ إِجَابَتُكَ صَحِيحَةً؛ فَقَطْ حَاوِلْ أَفْضَلَ مَا تَسْتَطِيعُ.",
  soundCheck: "مَرْحَبًا! هَلْ تَسْمَعُنِي جَيِّدًا؟",
  levelUp: "أَحْسَنْتَ! انْتَقَلْتَ إِلَى مُسْتَوًى جَدِيدٍ.",
} as const;

/** Paired-associate learning ("space friends") phrases, built from the creature names. */
export const palWhere = (name: string) => `أَيْنَ ${name}؟`;
export const palThis = (name: string) => `هَذَا ${name}.`;
export const palYes = (name: string) => `نَعَمْ، هَذَا ${name}!`;
