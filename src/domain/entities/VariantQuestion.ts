import type { QuestionType } from '../value-objects/QuestionType';
import type { Difficulty } from '../value-objects/Difficulty';
import type { ErrorType } from '../value-objects/ErrorType';
import type { BloomLevel } from '../value-objects/BloomLevel';
import type { VisualExplanation } from '../value-objects/VisualExplanation';

/**
 * Result of independently verifying a generated variant question's answer.
 */
export interface VariantVerificationResult {
  verified: boolean;
  aiComputedAnswer: string;
  generatedAnswer: string;
  match: boolean;
  confidence: 'high' | 'low';
}

/**
 * Result from the L4 AI pipeline stage: variant question generation.
 */
export interface VariantGenerationResult {
  diagnosisId: string | null;
  variants: {
    content: string;              // LaTeX
    type: QuestionType;
    options: string[] | null;
    answer: string;
    explanation: string;
    difficulty: Difficulty;
    targetErrorType: ErrorType;
    bloomLevel: BloomLevel;
    trapPoint: string | null;
    targetTimeSeconds: number | null;
    verification: VariantVerificationResult | null;
    visualExplanation: VisualExplanation | null;
  }[];
}

/**
 * An AI-generated variant question targeting a specific error type.
 * Created from an ErrorDiagnosis to help students practice weak areas.
 */
export interface VariantQuestion {
  id: string;
  diagnosisId: string | null;
  content: string;                // LaTeX string
  questionType: QuestionType;
  options: string[] | null;       // 5 options for multiple choice
  answer: string;
  explanation: string;            // Step-by-step with LaTeX
  difficulty: Difficulty;
  targetErrorType: ErrorType | null;
  userId: string | null;
  topic: string | null;
  grade: string | null;
  bloomLevel: BloomLevel | null;
  trapPoint: string | null;
  targetTimeSeconds: number | null;
  verification: VariantVerificationResult | null;
  visualExplanation: VisualExplanation | null;
  createdAt: string;              // ISO 8601
}
