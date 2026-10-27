#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Arabic Linguistic & Psychometric Auditor MCP Server
Provides deterministic validation tools for Arabic educational content,
including diacritics, syntax, morphology, stimulus leaks, and reading passage quality.
"""

import sys
import re
import json
from fastmcp import FastMCP
import pyarabic.araby as araby

mcp = FastMCP("arabic-linguist", description="Arabic Linguistic & Psychometric Quality Auditor")

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

@mcp.tool()
def audit_phonological_item(target_word: str, target_letter: str, expected_haraka: str) -> dict:
    """
    Verifies that the diacritic on a specific letter in a vocalized Arabic word matches the intended answer.
    Prevents errors like asking about the vowel on 'ب' in 'كِتَابٌ' when 'ب' actually has tanween damma.
    """
    letters, marks = araby.separate(target_word)
    detected = []
    matched = False
    actual_haraka = None
    
    for char, mark in zip(letters, marks):
        char_name = LETTER_NAMES.get(char, '')
        clean_mark = mark.replace(araby.SHADDA, '')
        h_name = None
        for h, name in HARAKA_NAMES.items():
            if h in clean_mark:
                h_name = name
                break
        detected.append({'char': char, 'char_name': char_name, 'haraka': h_name, 'raw_mark': mark})
        
        if char == target_letter or (char_name and char_name in target_letter):
            matched = True
            actual_haraka = h_name

    is_valid = matched and (actual_haraka is not None) and (actual_haraka in expected_haraka)
    return {
        "target_word": target_word,
        "target_letter": target_letter,
        "expected_haraka": expected_haraka,
        "actual_haraka": actual_haraka,
        "valid": is_valid,
        "letters_analysis": detected,
        "error": None if is_valid else f"Letter '{target_letter}' in '{target_word}' has haraka '{actual_haraka}', expected '{expected_haraka}'."
    }

@mcp.tool()
def audit_question_item(
    question_id: str,
    prompt: str,
    stimulus: str,
    options: list[str],
    correct_index: int,
    feedback: str
) -> dict:
    """
    Audits a multiple-choice question for duplicate options, stimulus leaks, and out-of-bound indices.
    """
    issues = []
    
    # 1. Bounds
    if correct_index < 0 or correct_index >= len(options):
        issues.append(f"Correct index {correct_index} out of bounds for options length {len(options)}")
        
    # 2. Distinct options
    if len(options) != len(set(options)):
        issues.append("Duplicate options found in question")
        
    # 3. Stimulus leak
    if 0 <= correct_index < len(options):
        correct_ans = options[correct_index]
        clean_ans = araby.strip_tashkeel(correct_ans).strip()
        clean_stim = araby.strip_tashkeel(stimulus or '').strip()
        
        if len(clean_ans) > 1 and clean_stim == clean_ans:
            issues.append(f"Stimulus directly reveals the correct answer: '{stimulus}' == '{correct_ans}'")
            
        # Check if stimulus contains an obvious arithmetic answer leak (e.g. prompt is word problem, stimulus is '4 + 3')
        if stimulus and re.match(r'^\d+\s*[\+\−\×\÷]\s*\d+$', stimulus.replace(' ', '')):
            if "كم" in prompt or "المجموع" in prompt or "بقي" in prompt:
                issues.append(f"Stimulus '{stimulus}' reveals the operation equation for a word problem prompt")

    return {
        "question_id": question_id,
        "valid": len(issues) == 0,
        "issues": issues
    }

@mcp.tool()
def audit_passage_text(
    passage_id: str,
    title: str,
    grade_level: int,
    declared_diacritic_level: str,
    words: list[str],
    comprehension_questions: list[dict]
) -> dict:
    """
    Validates an Arabic reading passage: word count, diacritic percentage, and comprehension question validity.
    """
    full_text = " ".join(words)
    word_count = len(words)
    issues = []
    
    if word_count < 50:
        issues.append(f"Passage word count ({word_count}) is below minimum threshold of 50 words")
        
    letters_count = 0
    diacritics_count = 0
    for ch in full_text:
        if araby.is_arabicrange(ch):
            if araby.is_tashkeel(ch):
                diacritics_count += 1
            elif ch.isalnum():
                letters_count += 1
                
    ratio = (diacritics_count / max(1, letters_count)) * 100
    
    if declared_diacritic_level == 'full' and ratio < 50:
        issues.append(f"Passage declared 'full' but diacritic density is {ratio:.1f}% (< 50%)")
    elif declared_diacritic_level == 'partial' and (ratio < 10 or ratio > 55):
        issues.append(f"Passage declared 'partial' but diacritic density is {ratio:.1f}% (expected 10-55%)")
    elif declared_diacritic_level == 'minimal' and ratio > 10:
        issues.append(f"Passage declared 'minimal' but diacritic density is {ratio:.1f}% (> 10%)")

    for idx, q in enumerate(comprehension_questions):
        opts = q.get('options', [])
        c_idx = q.get('correctIndex', -1)
        if len(opts) != len(set(opts)):
            issues.append(f"Comprehension Q{idx+1} has duplicate options")
        if c_idx < 0 or c_idx >= len(opts):
            issues.append(f"Comprehension Q{idx+1} has out-of-bounds correct index {c_idx}")

    return {
        "passage_id": passage_id,
        "word_count": word_count,
        "diacritic_ratio": round(ratio, 2),
        "declared_level": declared_diacritic_level,
        "valid": len(issues) == 0,
        "issues": issues
    }

if __name__ == "__main__":
    mcp.run()
