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
    if (!raw) return null;
    const saved = JSON.parse(raw) as CombinedAssessmentData & {
      eyeTrackingResults?: unknown;
      tactileResults?: unknown;
      speechResults?: unknown;
    };
    if (!saved || typeof saved !== 'object') return null;
    delete saved.eyeTrackingResults;
    delete saved.tactileResults;
    // Older versions stored guessed speech-confidence, pause, onset and pitch metrics.
    if (saved.speechResults) saved.speechResults = null;
    return saved;
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
    transcriptMatchesTarget: boolean;
    recognitionConfidence: number | null;
  }>;
  summary: {
    averageRecognitionConfidence: number | null;
    exactTranscriptMatches: number;
    transcriptsNeedingReview: number;
  };
}

export interface ReadingAssessmentResult {
  passageId: string;
  passageTitle: string;
  assessmentModality?: 'voice_only' | 'reading_only';
  gradeLevel: number;
  wordCount: number;
  durationSeconds: number;
  wpm: number;
  wcpm?: number | null;
  oralReadingAssessed?: boolean;
  oralAccuracyPercent?: number | null;
  phoneticSubstitutionCount?: number;
  omissionCount?: number;
  dialectVariantCount?: number;
  spokenTranscript?: string;
  teacherVerified?: boolean;
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
  readingResults?: ReadingAssessmentResult | null;
};

interface AssessmentContextType {
  currentAssessment: CombinedAssessmentData | null;
  setCurrentAssessment: (data: CombinedAssessmentData) => void;
  startNewAssessment: (studentName: string, age?: number, studentId?: string) => void;
  saveSpeechResults: (results: SpeechAssessmentResult) => void;
  saveReadingResults: (results: ReadingAssessmentResult) => void;
  saveSpeechAnalysisResults: (results: any) => void;
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
      readingResults: null,
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
        readingResults: prev?.readingResults || null,
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
      };
      persistAssessment(next);
      return next;
    });
  };

  const saveSpeechAnalysisResults = (analysisResults: any[]) => {
    if (!Array.isArray(analysisResults) || analysisResults.length === 0) return;

    const totalWords = analysisResults.length;
    const exactTranscriptMatches = analysisResults.filter(
      (item) => item.exactTranscriptMatch === true
    ).length;
    const confidenceValues = analysisResults
      .map((item) => item.speechRecognitionConfidence)
      .filter((value): value is number =>
        typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
      );
    const averageRecognitionConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : null;

    const speechResult: SpeechAssessmentResult = {
      studentId: currentAssessment?.studentId || 'student-1',
      studentName: currentAssessment?.studentName || 'الطالب',
      age: currentAssessment?.age || 8,
      date: new Date().toLocaleDateString('ar-SA'),
      words: analysisResults.map((item) => {
        const target = String(item.targetWord ?? '');
        const recognized = String(item.spokenTranscript ?? '');
        const confidence = item.speechRecognitionConfidence;
        return {
          word: target,
          expected: target,
          recognized,
          transcriptMatchesTarget: item.exactTranscriptMatch === true,
          recognitionConfidence:
            typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 100
              ? confidence
              : null,
        };
      }),
      summary: {
        averageRecognitionConfidence,
        exactTranscriptMatches,
        transcriptsNeedingReview: Math.max(0, totalWords - exactTranscriptMatches),
      },
    };

    saveSpeechResults(speechResult);
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
    saveReadingResults,
        saveSpeechAnalysisResults,
        getAllAssessments,
        clearCurrentAssessment,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};
