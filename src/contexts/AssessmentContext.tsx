/**
 * Assessment Data Context
 * Central data management for all assessment results
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'baseera_active_assessment';

const loadSavedAssessment = (): CombinedAssessmentData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistAssessment = (data: CombinedAssessmentData | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to save assessment to localStorage', err);
  }
};

export interface SpeechAssessmentResult {
  studentId: string;
  studentName: string;
  age: number;
  date: string;
  words: Array<{
    word: string;
    expected: string;
    recognized: string;
    correct: boolean;
    confidence: number;
    pauseCount: number;
    hesitationMs: number;
    pitchVariation: number;
  }>;
  summary: {
    averageConfidence: number;
    totalPauses: number;
    wordsNeedingImprovement: number;
    problematicLetters: string[];
    diacriticErrors: number;
    hesitationMs: number;
  };
}

export interface TactileAssessmentResult {
  studentId: string;
  studentName: string;
  date: string;
  tasks: Array<{
    taskId: number;
    type: string;
    correct: boolean;
    reactionTime: number;
    completionTime: number;
    hesitationCount: number;
    curvature: number;
  }>;
  summary: {
    averageReactionTime: number;
    correctAnswers: number;
    totalTasks: number;
    hesitationCount: number;
    weakAreas: string[];
  };
}

export interface ReadingAssessmentResult {
  passageId: string;
  passageTitle: string;
  gradeLevel: number;
  wordCount: number;
  durationSeconds: number;
  wpm: number;
  comprehensionScore: number;
  correctAnswersCount: number;
  totalQuestionsCount: number;
  readingRulerUsed?: boolean;
  completedAt: string;
}

export interface CombinedAssessmentData {
  studentId: string;
  studentName: string;
  age: number;
  speechResults: SpeechAssessmentResult | null;
  tactileResults: TactileAssessmentResult | null;
  readingResults?: ReadingAssessmentResult | null;
  eyeTrackingResults?: any | null;
};

interface AssessmentContextType {
  currentAssessment: CombinedAssessmentData | null;
  setCurrentAssessment: (data: CombinedAssessmentData) => void;
  startNewAssessment: (studentName: string, age?: number, studentId?: string) => void;
  saveSpeechResults: (results: SpeechAssessmentResult) => void;
  saveTactileResults: (results: TactileAssessmentResult) => void;
  saveReadingResults: (results: ReadingAssessmentResult) => void;
  saveEyeTrackingResults: (results: any) => void;
  saveSpeechAnalysisResults: (results: any) => void;
  saveTactileAnalyticsResults: (results: any) => void;
  getAllAssessments: () => CombinedAssessmentData[];
  clearCurrentAssessment: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const useAssessment = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within AssessmentProvider');
  }
  return context;
};

interface AssessmentProviderProps {
  children: ReactNode;
}

export const AssessmentProvider: React.FC<AssessmentProviderProps> = ({ children }) => {
  const [currentAssessment, setCurrentAssessment] = useState<CombinedAssessmentData | null>(loadSavedAssessment);
  const [assessments, setAssessments] = useState<CombinedAssessmentData[]>(() => {
    const saved = loadSavedAssessment();
    return saved ? [saved] : [];
  });

  useEffect(() => {
    if (currentAssessment) {
      persistAssessment(currentAssessment);
      setAssessments(prev => {
        const filtered = prev.filter(a => a.studentId !== currentAssessment.studentId);
        return [currentAssessment, ...filtered];
      });
    }
  }, [currentAssessment]);

  const startNewAssessment = (studentName: string, age = 8, studentId = 'student-' + Date.now()) => {
    const fresh: CombinedAssessmentData = {
      studentId,
      studentName,
      age,
      speechResults: null,
      tactileResults: null,
      readingResults: null,
      eyeTrackingResults: null,
    };
    setCurrentAssessment(fresh);
    persistAssessment(fresh);
  };

  const saveSpeechResults = (results: SpeechAssessmentResult) => {
    setCurrentAssessment(prev => {
      const next: CombinedAssessmentData = {
        studentId: results.studentId || prev?.studentId || 'student-1',
        studentName: results.studentName || prev?.studentName || 'الطالب',
        age: results.age || prev?.age || 8,
        speechResults: results,
        tactileResults: prev?.tactileResults || null,
        readingResults: prev?.readingResults || null,
        eyeTrackingResults: prev?.eyeTrackingResults || null,
      };
      persistAssessment(next);
      return next;
    });
  };

  const saveTactileResults = (results: TactileAssessmentResult) => {
    setCurrentAssessment(prev => {
      const next: CombinedAssessmentData = {
        studentId: results.studentId || prev?.studentId || 'student-1',
        studentName: results.studentName || prev?.studentName || 'الطالب',
        age: prev?.age || 8,
        speechResults: prev?.speechResults || null,
        tactileResults: results,
        readingResults: prev?.readingResults || null,
        eyeTrackingResults: prev?.eyeTrackingResults || null,
      };
      persistAssessment(next);
      return next;
    });
  };

  const saveReadingResults = (results: ReadingAssessmentResult) => {
    setCurrentAssessment(prev => {
      const next: CombinedAssessmentData = {
        studentId: prev?.studentId || 'student-1',
        studentName: prev?.studentName || 'الطالب',
        age: prev?.age || 8,
        speechResults: prev?.speechResults || null,
        tactileResults: prev?.tactileResults || null,
        readingResults: results,
        eyeTrackingResults: {
          wpm: results.wpm,
          readingDurationSeconds: results.durationSeconds,
          comprehensionScore: results.comprehensionScore,
          completedAt: results.completedAt,
        },
      };
      persistAssessment(next);
      return next;
    });
  };

  const saveEyeTrackingResults = (results: any) => {
    setCurrentAssessment(prev => {
      const next: CombinedAssessmentData = {
        studentId: prev?.studentId || 'student-1',
        studentName: prev?.studentName || 'الطالب',
        age: prev?.age || 8,
        speechResults: prev?.speechResults || null,
        tactileResults: prev?.tactileResults || null,
        readingResults: prev?.readingResults || null,
        eyeTrackingResults: results,
      };
      persistAssessment(next);
      return next;
    });
  };

  const saveSpeechAnalysisResults = (analysisResults: any[]) => {
    if (!Array.isArray(analysisResults) || analysisResults.length === 0) return;

    const totalWords = analysisResults.length;
    const correctWords = analysisResults.filter(r => Boolean(r.isCorrect ?? r.correct)).length;

    const confidenceSum = analysisResults.reduce((sum, r) => {
      const val = Number(r.acousticConfidence ?? r.confidence ?? r.phoneticSimilarity ?? 80);
      return sum + (Number.isFinite(val) ? val : 80);
    }, 0);
    const averageConfidence = Math.round(confidenceSum / totalWords);

    const totalPauses = analysisResults.reduce((sum, r) => {
      const val = Number(r.intraWordPauses ?? r.pauseCount ?? 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);

    const wordsNeedingImprovement = totalWords - correctWords;

    // Safely extract problematic letters from actual target words
    const problematicLetters: string[] = [];
    analysisResults.forEach(r => {
      const isWordCorrect = Boolean(r.isCorrect ?? r.correct);
      const wordText = String(r.targetWord ?? r.word ?? r.expectedWord ?? r.expected ?? '').trim();
      if (!isWordCorrect && wordText) {
        const letter = wordText.charAt(0);
        if (letter && !problematicLetters.includes(letter)) {
          problematicLetters.push(letter);
        }
      }
    });

    // Safely count diacritic errors without assuming r.word exists
    const diacriticErrors = analysisResults.filter(r => {
      const isWordCorrect = Boolean(r.isCorrect ?? r.correct);
      const wordText = String(r.targetWord ?? r.word ?? r.expectedWord ?? r.expected ?? '');
      const hasDiacritics =
        wordText.includes('َ') ||
        wordText.includes('ُ') ||
        wordText.includes('ِ') ||
        wordText.includes('ً') ||
        wordText.includes('ٌ') ||
        wordText.includes('ٍ') ||
        wordText.includes('ّ');
      return hasDiacritics && !isWordCorrect;
    }).length;

    const latencySum = analysisResults.reduce((sum, r) => {
      const val = Number(r.voiceOnsetLatencyMs ?? r.hesitationMs ?? 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
    const avgHesitation = Math.round(latencySum / totalWords);

    const speechResult: SpeechAssessmentResult = {
      studentId: currentAssessment?.studentId || 'student-1',
      studentName: currentAssessment?.studentName || 'الطالب',
      age: currentAssessment?.age || 8,
      date: new Date().toLocaleDateString('ar-SA'),
      words: analysisResults.map(r => {
        const target = String(r.targetWord ?? r.word ?? r.expectedWord ?? r.expected ?? '');
        const recognized = String(r.spokenTranscript ?? r.recognized ?? r.recognizedWord ?? '');
        const conf = Number(r.acousticConfidence ?? r.confidence ?? r.phoneticSimilarity ?? 80);
        const pauses = Number(r.intraWordPauses ?? r.pauseCount ?? 0);
        const latency = Number(r.voiceOnsetLatencyMs ?? r.hesitationMs ?? 0);
        const pitch = Number(r.f0VariationHz ?? r.pitchVariation ?? 0);
        return {
          word: target,
          expected: target,
          recognized,
          correct: Boolean(r.isCorrect ?? r.correct),
          confidence: Number.isFinite(conf) ? conf : 80,
          pauseCount: Number.isFinite(pauses) ? pauses : 0,
          hesitationMs: Number.isFinite(latency) ? latency : 0,
          pitchVariation: Number.isFinite(pitch) ? pitch : 0,
        };
      }),
      summary: {
        averageConfidence,
        totalPauses,
        wordsNeedingImprovement,
        problematicLetters,
        diacriticErrors,
        hesitationMs: avgHesitation,
      },
    };

    saveSpeechResults(speechResult);
  };

  const saveTactileAnalyticsResults = (taskResults: any[]) => {
    if (!Array.isArray(taskResults) || taskResults.length === 0) return;

    const correctAnswers = taskResults.filter(r => Boolean(r.correctness ?? r.correct)).length;
    const reactionSum = taskResults.reduce((sum, r) => {
      const val = Number(r.reactionTime ?? 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
    const averageReactionTime = Math.round(reactionSum / taskResults.length);

    const totalHesitation = taskResults.reduce((sum, r) => {
      const val = Number(r.hesitationCount ?? 0);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);

    // Determine weak areas
    const weakAreas: string[] = [];
    taskResults.forEach((r) => {
      const isCorrect = Boolean(r.correctness ?? r.correct);
      if (!isCorrect) {
        if (r.type === 'sort') weakAreas.push('ترتيب الأرقام');
        if (r.type === 'compare') weakAreas.push('المقارنة السريعة');
        if (r.type === 'match') weakAreas.push('العد والمطابقة');
      }
    });

    const tactileResult: TactileAssessmentResult = {
      studentId: currentAssessment?.studentId || 'student-1',
      studentName: currentAssessment?.studentName || 'الطالب',
      date: new Date().toLocaleDateString('ar-SA'),
      tasks: taskResults.map((r, idx) => ({
        taskId: idx + 1,
        type: String(r.type || 'unknown'),
        correct: Boolean(r.correctness ?? r.correct),
        reactionTime: Number(r.reactionTime) || 0,
        completionTime: Number(r.completionTime) || 0,
        hesitationCount: Number(r.hesitationCount) || 0,
        curvature: Number(r.averageCurvature) || 0,
      })),
      summary: {
        averageReactionTime,
        correctAnswers,
        totalTasks: taskResults.length,
        hesitationCount: totalHesitation,
        weakAreas: [...new Set(weakAreas)],
      },
    };

    saveTactileResults(tactileResult);
  };

  const getAllAssessments = () => {
    return assessments;
  };

  const clearCurrentAssessment = () => {
    setCurrentAssessment(null);
    persistAssessment(null);
  };

  return (
    <AssessmentContext.Provider
      value={{
        currentAssessment,
        setCurrentAssessment,
        startNewAssessment,
        saveSpeechResults,
        saveTactileResults,
    saveReadingResults,
        saveEyeTrackingResults,
        saveSpeechAnalysisResults,
        saveTactileAnalyticsResults,
        getAllAssessments,
        clearCurrentAssessment,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};
