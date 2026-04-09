import type { Subject, SubjectOrOther, ServiceTier } from '../value-objects/Subject';
import type { ErrorType } from '../value-objects/ErrorType';

/**
 * Determine the service tier for a given subject.
 * Tier 1 (ai_analysis): math, korean, english — full L1-L4 pipeline
 * Tier 2 (digitization): other — OCR only, student self-scores
 */
export function getServiceTier(subject: SubjectOrOther): ServiceTier {
  if (subject === 'math' || subject === 'korean' || subject === 'english') {
    return 'ai_analysis';
  }
  return 'digitization';
}

/**
 * Check if a subject is a Tier 1 AI-analyzed subject.
 */
export function isAiSubject(subject: SubjectOrOther): subject is Subject {
  return subject !== 'other';
}

/**
 * Get the valid error types for a given AI-analyzed subject.
 */
export function getErrorTypesForSubject(subject: Subject): ErrorType[] {
  switch (subject) {
    case 'math':
      return ['concept_gap', 'calculation_error', 'time_pressure'];
    case 'korean':
      return ['comprehension_error', 'grammar_error', 'vocabulary_gap', 'interpretation_error', 'time_pressure'];
    case 'english':
      return ['grammar_error', 'vocabulary_gap', 'comprehension_error', 'time_pressure'];
  }
}

/**
 * Validate that an error type is valid for the given subject.
 */
export function isValidErrorTypeForSubject(errorType: ErrorType, subject: Subject): boolean {
  return getErrorTypesForSubject(subject).includes(errorType);
}

/**
 * Get the Korean display label for a subject.
 */
export function getSubjectLabel(subject: SubjectOrOther): string {
  switch (subject) {
    case 'math': return '수학';
    case 'korean': return '국어';
    case 'english': return '영어';
    case 'other': return '기타';
  }
}

/**
 * All subjects available for Tier 1 AI analysis.
 */
export const AI_SUBJECTS: readonly Subject[] = ['math', 'korean', 'english'] as const;

/**
 * All subjects including digitization-only.
 */
export const ALL_SUBJECTS: readonly SubjectOrOther[] = ['math', 'korean', 'english', 'other'] as const;
