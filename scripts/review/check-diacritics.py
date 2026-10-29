"""
Morphological check of every vowelled word in the content review bank with CAMeL Tools
(calima-msa-r13). A word is flagged when none of its possible analyses agrees with the
vowels written in Baseera (contradictory short vowel or missing/extra shadda; case endings
and pausal forms on the last letter are ignored). Flags are hints for the human reviewer,
not verdicts: dialect words, pseudo-words and names are expected to be flagged.

Usage:
  npx tsx scripts/review/export-units.ts > /tmp/units.json
  python scripts/review/check-diacritics.py /tmp/units.json > src/review/machineFlags.json
Requires: pip install camel-tools && camel_data -i morphology-db-msa-r13
"""
import json, re, sys
from camel_tools.morphology.database import MorphologyDB
from camel_tools.morphology.analyzer import Analyzer
from camel_tools.utils.dediac import dediac_ar

analyzer = Analyzer(MorphologyDB.builtin_db('calima-msa-r13'), backoff='NONE')
DIAC = re.compile(r'[ً-ْ]')
VOWELS = set('ًٌٍَُِ')
SHADDA = 'ّ'

def norm(w):
    return w.replace('ٱ', 'ا').replace('ـ', '').replace('ٰ', '')

def compatible(word, cand):
    wl = re.findall(r'([ء-ي])([ً-ْ]*)', word)
    cl = re.findall(r'([ء-ي])([ً-ْ]*)', cand)
    if [a for a, _ in wl] != [a for a, _ in cl]:
        return False
    for i, ((_, wd), (_, cd)) in enumerate(zip(wl, cl)):
        if i == len(wl) - 1:
            break
        wv, cv = set(wd) & VOWELS, set(cd) & VOWELS
        if wv and cv and wv != cv:
            return False
        letters = [x for x, _ in wl]
        # Sun-letter shadda after the article, also after a prefix (و، ف، ب، ك) or «لِلْ».
        sun_letter = (i == 2 and letters[:2] in (['ا', 'ل'], ['ل', 'ل'])) or (i == 3 and letters[1:3] == ['ا', 'ل'])
        if (SHADDA in wd) != (SHADDA in cd) and cd and not sun_letter:
            return False
    return True

# Checked by hand: correct as written; the MSA database lacks these forms or prefers a variant.
REVIEWED = {
    'مُسْتَوًى': 'تنوين الفتح على الألف المقصورة صحيح',
    'بُرْتُقَالَة': 'اسم الوحدة من البرتقال، صحيح',
    'ضِفْدَع': 'ضِفْدَع بكسر الضاد هي الفصحى المشهورة، وضَفْدَع لغة',
    'الطَّازَجَةَ': 'طازَج بفتح الزاي في المعاجم الحديثة',
    'التُّمُورِ': 'جمع تَمْر',
    'الْجُلُودِ': 'جمع جِلْد',
    'وَالْجُلُودِ': 'جمع جِلْد',
    'تُخَزَّنُ': 'مبني للمجهول',
    'تُثَبَّتُ': 'مبني للمجهول',
    'المتعلَّمة': 'اسم مفعول: الكلمات التي تعلّمها الطفل',
    'يُفضَّل': 'مبني للمجهول (تشكيل جزئي)',
    'الْمِسْ': 'فعل أمر من لَمَسَ',
    'الْمِسِ': 'فعل أمر من لَمَسَ، كُسر آخره لالتقاء الساكنين',
    'صَفِّقْ': 'فعل أمر من صَفَّقَ',
    'حَاوِلْ': 'فعل أمر من حاوَلَ',
    'وَرَكِّبْهَا': 'فعل أمر من رَكَّبَ',
    'تَانْ': 'مقطع صوتي في تمرين التركيب، وليس كلمة',
}

def is_imperative(t):
    # Imperative with a connecting hamza: اسْمَعْ، انْظُرْ، اخْتَرْ، فَاخْتَرْ (not the article «الْ»).
    return re.match(r'^([وف]\u064e)?ا([\u0621-\u0643\u0645-\u064A])\u0652', t) is not None

def canon(w):
    # Same word regardless of the order its marks were typed in.
    return re.sub(r'[\u064B-\u0652]+', lambda m: ''.join(sorted(m.group())), norm(w))

REVIEWED_CANON = {canon(k) for k in REVIEWED}

cache = {}
UNCHECKED = set()
def suspicious(token):
    t = norm(token)
    if canon(token) in REVIEWED_CANON or is_imperative(t):
        return None
    if len(DIAC.findall(t)) < 2:
        return None
    bare = dediac_ar(t)
    if len(bare) < 3:
        return None
    if t not in cache:
        analyses = analyzer.analyze(bare)
        if not analyses:
            UNCHECKED.add(t)
            cache[t] = None
        else:
            ok = any(compatible(t, norm(a['diac'])) for a in analyses)
            cache[t] = None if ok else sorted({a['diac'] for a in analyses})[:4]
    return cache[t]

units = json.load(open(sys.argv[1], encoding='utf-8'))
flags = {}
for u in units:
    seen = set()
    for f in u['fields']:
        for tok in re.findall(r'[ء-ْٰٱ]+', f['text']):
            if tok in seen:
                continue
            seen.add(tok)
            alt = suspicious(tok)
            if alt:
                flags.setdefault(u['id'], []).append(f'التشكيل: «{tok}» لا يطابق أي تحليل صرفي. المقترح: {" / ".join(alt)}')
json.dump(flags, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
checked = len(cache) - len(UNCHECKED)
print(f'checked {checked} vowelled words; flagged {sum(len(v) for v in flags.values())}; '
      f'not in the MSA database (dialect, pseudo-words, names, syllables) {len(UNCHECKED)}: '
      + '، '.join(sorted(UNCHECKED)), file=sys.stderr)
