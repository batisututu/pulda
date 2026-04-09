import type { ErrorType } from '../value-objects/ErrorType';
import type { VisualExplanation } from '../value-objects/VisualExplanation';

/**
 * Result of the verification step confirming the AI's answer.
 */
export interface VerificationResult {
  verified: boolean;
  verifierAnswer: string;
  match: boolean;
}

/**
 * Explanation result from the L3 AI pipeline stage.
 */
export interface ExplanationResult {
  questionId: string;
  errorType: ErrorType;
  confidence: number;
  correctAnswer: string;
  stepByStep: string;             // with LaTeX (text fallback)
  errorReasoning: string;         // Korean
  correctionGuidance: string;     // Korean
  verification: VerificationResult;
  visualExplanation: VisualExplanation | null;
}

/**
 * Diagnosis of an incorrect answer, including error classification,
 * reasoning, and step-by-step correction guidance.
 */
export interface ErrorDiagnosis {
  id: string;
  questionId: string;
  errorType: ErrorType;
  confidence: number;             // 0.0 - 1.0
  reasoning: string;              // Korean explanation
  correction: string;             // Korean correction guidance
  stepByStep: string | null;      // Step-by-step solution with LaTeX (text fallback)
  verificationResult: VerificationResult | null;
  visualExplanation: VisualExplanation | null;
  createdAt: string;              // ISO 8601
}
