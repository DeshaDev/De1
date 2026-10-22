/**
 * Assessment Data Context
 * Central data management for all assessment results
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

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

export interface CombinedAssessmentData {
  studentId: string;
  studentName: string;
  age: number;
  speechResults: SpeechAssessmentResult | null;
  tactileResults: TactileAssessmentResult | null;
  eyeTrackingResults?: any | null;
}

interface AssessmentContextType {
  currentAssessment: CombinedAssessmentData | null;
  setCurrentAssessment: (data: CombinedAssessmentData) => void;
  startNewAssessment: (studentName: string, age?: number, studentId?: string) => void;
  saveSpeechResults: (results: SpeechAssessmentResult) => void;
  saveTactileResults: (results: TactileAssessmentResult) => void;
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
  const [currentAssessment, setCurrentAssessment] = useState<CombinedAssessmentData | null>(null);
  const [assessments, setAssessments] = useState<CombinedAssessmentData[]>([]);

  const startNewAssessment = (studentName: string, age = 8, studentId = 'student-' + Date.now()) => {
    setCurrentAssessment({
      studentId,
      studentName,
      age,
      speechResults: null,
      tactileResults: null,
      eyeTrackingResults: null,
    });
  };

  const saveSpeechResults = (results: SpeechAssessmentResult) => {
    setCurrentAssessment(prev => ({
      studentId: results.studentId || prev?.studentId || 'student-1',
      studentName: results.studentName || prev?.studentName || 'الطالب',
      age: results.age || prev?.age || 8,
      speechResults: results,
      tactileResults: prev?.tactileResults || null,
      eyeTrackingResults: prev?.eyeTrackingResults || null,
    }));
  };

  const saveTactileResults = (results: TactileAssessmentResult) => {
    setCurrentAssessment(prev => ({
      studentId: results.studentId || prev?.studentId || 'student-1',
      studentName: results.studentName || prev?.studentName || 'الطالب',
      age: prev?.age || 8,
      speechResults: prev?.speechResults || null,
      tactileResults: results,
      eyeTrackingResults: prev?.eyeTrackingResults || null,
    }));
  };

  const saveEyeTrackingResults = (results: any) => {
    setCurrentAssessment(prev => ({
      studentId: prev?.studentId || 'student-1',
      studentName: prev?.studentName || 'الطالب',
      age: prev?.age || 8,
      speechResults: prev?.speechResults || null,
      tactileResults: prev?.tactileResults || null,
      eyeTrackingResults: results,
    }));
  };

  const saveSpeechAnalysisResults = (analysisResults: any[]) => {
    // Calculate summary from analysis results
    const correctWords = analysisResults.filter(r => r.isCorrect).length;
    const averageConfidence = analysisResults.reduce((sum, r) => sum + r.confidence, 0) / analysisResults.length;
    const totalPauses = analysisResults.reduce((sum, r) => sum + r.pauseCount, 0);
    const wordsNeedingImprovement = analysisResults.filter(r => !r.isCorrect).length;

    // Extract problematic letters
    const problematicLetters: string[] = [];
    analysisResults.forEach(r => {
      if (!r.isCorrect) {
        const letter = r.expectedWord.charAt(0);
        if (!problematicLetters.includes(letter)) {
          problematicLetters.push(letter);
        }
      }
    });

    const diacriticErrors = analysisResults.filter(r =>
      r.word.includes('َ') || r.word.includes('ُ') || r.word.includes('ِ')
    ).filter(r => !r.isCorrect).length;

    const avgHesitation = analysisResults.reduce((sum, r) => sum + r.hesitationMs, 0) / analysisResults.length;

    const speechResult: SpeechAssessmentResult = {
      studentId: 'student-1',
      studentName: 'الطالب',
      age: 8,
      date: new Date().toLocaleDateString('ar-SA'),
      words: analysisResults.map(r => ({
        word: r.word,
        expected: r.expectedWord,
        recognized: r.recognizedWord,
        correct: r.isCorrect,
        confidence: r.confidence,
        pauseCount: r.pauseCount,
        hesitationMs: r.hesitationMs,
        pitchVariation: r.pitchVariation,
      })),
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
    const correctAnswers = taskResults.filter(r => r.correctness).length;
    const averageReactionTime = taskResults.reduce((sum, r) => sum + r.reactionTime, 0) / taskResults.length;
    const totalHesitation = taskResults.reduce((sum, r) => sum + r.hesitationCount, 0);

    // Determine weak areas
    const weakAreas: string[] = [];
    taskResults.forEach((r, idx) => {
      if (!r.correctness) {
        if (r.type === 'sort') weakAreas.push('ترتيب الأرقام');
        if (r.type === 'compare') weakAreas.push('المقارنة السريعة');
        if (r.type === 'match') weakAreas.push('العد والمطابقة');
      }
    });

    const tactileResult: TactileAssessmentResult = {
      studentId: 'student-1',
      studentName: 'الطالب',
      date: new Date().toLocaleDateString('ar-SA'),
      tasks: taskResults.map((r, idx) => ({
        taskId: idx + 1,
        type: r.type || 'unknown',
        correct: r.correctness,
        reactionTime: r.reactionTime,
        completionTime: r.completionTime,
        hesitationCount: r.hesitationCount,
        curvature: r.averageCurvature || 0,
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
  };

  return (
    <AssessmentContext.Provider
      value={{
        currentAssessment,
        setCurrentAssessment,
        startNewAssessment,
        saveSpeechResults,
        saveTactileResults,
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
