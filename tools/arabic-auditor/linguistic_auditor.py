import json
import re
import sys
import pyarabic.araby as araby

HARAKA_NAMES = {
    araby.FATHA: 'فتحة',
    araby.DAMMA: 'ضمة',
    araby.KASRA: 'كسرة',
    araby.SUKUN: 'سكون',
    araby.FATHATAN: 'تنوين فتح',
    araby.DAMMATAN: 'تنوين ضم',
    araby.KASRATAN: 'تنوين كسر',
}

LETTER_NAMES = {
    'أ': 'ألف', 'ا': 'ألف', 'إ': 'همزة', 'ء': 'همزة',
    'ب': 'الباء', 'ت': 'التاء', 'ث': 'الثاء',
    'ج': 'الجيم', 'ح': 'الحاء', 'خ': 'الخاء',
    'د': 'الدال', 'ذ': 'الذال', 'ر': 'الراء', 'ز': 'الزاي',
    'س': 'السين', 'ش': 'الشين', 'ص': 'الصاد', 'ض': 'الضاد',
    'ط': 'الطاء', 'ظ': 'الظاء', 'ع': 'العين', 'غ': 'الغين',
    'ف': 'الفاء', 'ق': 'القاف', 'ك': 'الكاف', 'ل': 'اللام',
    'م': 'الميم', 'ن': 'النون', 'ه': 'الهاء', 'و': 'الواو',
    'ي': 'الياء', 'ى': 'الألف المقصورة', 'ة': 'التاء المربوطة',
}

def analyze_letter_harakat(word):
    """Decompose word into list of (letter, haraka_name, is_shadda)"""
    letters, marks = araby.separate(word)
    result = []
    for char, mark in zip(letters, marks):
        is_sh = araby.SHADDA in mark
        clean_mark = mark.replace(araby.SHADDA, '')
        haraka_name = None
        for h, name in HARAKA_NAMES.items():
            if h in clean_mark:
                haraka_name = name
                break
        result.append({
            'char': char,
            'haraka_name': haraka_name,
            'has_shadda': is_sh,
            'raw_mark': mark
        })
    return result

def audit_questions(questions):
    findings = []
    print(f"Auditing {len(questions)} curriculum questions...")
    
    for idx, q in enumerate(questions):
        qid = q['questionId']
        q_text = q['prompt']
        stimulus = q.get('stimulus', '') or ''
        options = q['options']
        c_idx = q['correctIndex']
        correct_ans = q['correctAnswer']
        expl = q.get('feedbackCorrect', '') or ''
        
        # 1. Distinct options check
        if len(options) != len(set(options)):
            findings.append({
                'id': qid,
                'type': 'DUPLICATE_OPTIONS',
                'severity': 'HIGH',
                'message': f"خيارات مكررة في السؤال: {options}"
            })
            
        # 2. CorrectIndex bounds check
        if c_idx < 0 or c_idx >= len(options):
            findings.append({
                'id': qid,
                'type': 'INVALID_CORRECT_INDEX',
                'severity': 'CRITICAL',
                'message': f"مؤشر الإجابة الصحيحة ({c_idx}) خارج حدود الخيارات ({len(options)})."
            })
            
        # 3. Stimulus leak check
        clean_correct = araby.strip_tashkeel(correct_ans).strip()
        clean_q = araby.strip_tashkeel(q_text).strip()
        clean_stim = araby.strip_tashkeel(stimulus).strip()
        
        if len(clean_correct) > 2:
            # Check if stimulus is exactly the answer or contains it alone
            if clean_stim == clean_correct:
                findings.append({
                    'id': qid,
                    'type': 'STIMULUS_LEAK',
                    'severity': 'HIGH',
                    'message': f"المحفز ({stimulus}) يكشف الإجابة الصحيحة ({correct_ans}) بشكل مباشر!"
                })
                
        # 4. Phonological Letter Haraka Verification
        # Pattern e.g. "ما الحركة على (الحرف) في «الكلمة»؟"
        haraka_match = re.search(r'الحركة على ([^ ]+) في [«"]([^»"]+)[»"]', q_text)
        if haraka_match:
            target_letter_desc = haraka_match.group(1).strip()
            target_word = haraka_match.group(2).strip()
            
            decomp = analyze_letter_harakat(target_word)
            found = False
            for item in decomp:
                char_name = LETTER_NAMES.get(item['char'], '')
                if item['char'] in target_letter_desc or (char_name and char_name in target_letter_desc):
                    found = True
                    actual_haraka = item['haraka_name']
                    if actual_haraka and actual_haraka not in correct_ans:
                        findings.append({
                            'id': qid,
                            'type': 'HARAKA_MISMATCH',
                            'severity': 'CRITICAL',
                            'message': f"السؤال يسأل عن حركة {target_letter_desc} في «{target_word}». الحركة الفعلية مشكولة هي ({actual_haraka})، لكن مفتاح الإجابة ({correct_ans})!"
                        })
                    break
                    
        # 5. Incompatible consecutive diacritics in Arabic texts
        for field_name, text in [('question', q_text), ('stimulus', stimulus), ('explanation', expl)] + [(f'option_{i}', o) for i, o in enumerate(options)]:
            for i in range(len(text) - 1):
                c1, c2 = text[i], text[i+1]
                if araby.is_haraka(c1) and araby.is_haraka(c2):
                    # Shadda + haraka is allowed, but two short vowels consecutively is an error
                    if c1 != araby.SHADDA and c2 != araby.SHADDA:
                        findings.append({
                            'id': qid,
                            'type': 'ILLEGAL_DIACRITICS',
                            'severity': 'MEDIUM',
                            'message': f"حركتان متتاليتان في {field_name}: '{c1}{c2}' في النص: {text}"
                        })

    return findings

def audit_passages(passages):
    findings = []
    print(f"Auditing {len(passages)} reading passages...")
    
    for p in passages:
        pid = p['id']
        words = p['words']
        full_text = p['fullText']
        declared_level = p['diacriticLevel']
        grade = p['gradeLevel']
        word_count = len(words)
        
        # 1. Word count check
        if word_count < 50:
            findings.append({
                'id': pid,
                'type': 'SHORT_PASSAGE',
                'severity': 'HIGH',
                'message': f"عدد الكلمات ({word_count}) أقل من الحد الأدنى المعياري (50 كلمة)."
            })
            
        # 2. Diacritic ratio calculation
        letters_count = 0
        diacritics_count = 0
        for ch in full_text:
            if araby.is_arabicrange(ch):
                if araby.is_tashkeel(ch):
                    diacritics_count += 1
                elif ch.isalnum():
                    letters_count += 1
                    
        ratio = (diacritics_count / max(1, letters_count)) * 100
        
        # Validate against declaredLevel
        if declared_level == 'full' and ratio < 50:
            findings.append({
                'id': pid,
                'type': 'DIACRITIC_MISMATCH',
                'severity': 'HIGH',
                'message': f"النص موسوم بـ 'مشكول بالكامل' (full) لكن نسبة التشكيل الفعلية {ratio:.1f}% فقط!"
            })
        elif declared_level == 'partial' and (ratio < 10 or ratio > 55):
            findings.append({
                'id': pid,
                'type': 'DIACRITIC_MISMATCH',
                'severity': 'MEDIUM',
                'message': f"النص موسوم بـ 'مشكول جزئياً' (partial) ونسبة التشكيل {ratio:.1f}% خارج المدى المتوقع (10%-55%)."
            })
        elif declared_level == 'minimal' and ratio > 10:
            findings.append({
                'id': pid,
                'type': 'DIACRITIC_MISMATCH',
                'severity': 'HIGH',
                'message': f"النص موسوم بـ 'بدون تشكيل' (minimal) لكن نسبة التشكيل الفعلية {ratio:.1f}% تتجاوز 10%!"
            })
            
        # 3. Comprehension questions audit
        for q_idx, cq in enumerate(p.get('comprehensionQuestions', [])):
            q_text = cq['question']
            opts = cq['options']
            c_idx = cq['correctIndex']
            
            if len(opts) != len(set(opts)):
                findings.append({
                    'id': f"{pid}-q{q_idx+1}",
                    'type': 'DUPLICATE_OPTIONS',
                    'severity': 'HIGH',
                    'message': f"خيارات مكررة في سؤال الفهم القرائي: {opts}"
                })
            if c_idx < 0 or c_idx >= len(opts):
                findings.append({
                    'id': f"{pid}-q{q_idx+1}",
                    'type': 'INVALID_CORRECT_INDEX',
                    'severity': 'CRITICAL',
                    'message': f"مؤشر الإجابة ({c_idx}) خارج الحدود ({len(opts)})."
                })
                
    return findings

def main():
    with open('tools/arabic-auditor/exported_arabic_content.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    q_findings = audit_questions(data['questions'])
    p_findings = audit_passages(data['passages'])
    
    all_findings = q_findings + p_findings
    print("\n" + "="*50)
    print(f"AUDIT SUMMARY: {len(all_findings)} issues identified")
    print("="*50)
    
    for f in all_findings:
        print(f"[{f['severity']}] {f['id']} - {f['type']}: {f['message']}")
        
    with open('tools/arabic-auditor/audit_report.json', 'w', encoding='utf-8') as out:
        json.dump(all_findings, out, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    main()
