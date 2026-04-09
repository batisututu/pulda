import type { ErrorDiagnosis, VerificationResult } from '@/domain/entities';
import type { ErrorType, VisualExplanation } from '@/domain/value-objects';

/**
 * Database row shape for the `error_diagnoses` table (snake_case).
 */
export interface DiagnosisRow {
  id: string;
  question_id: string;
  error_type: string;
  confidence: number;
  reasoning: string;
  correction: string;
  step_by_step: string | null;
  verification_result: Record<string, unknown> | null;
  visual_explanation: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Maps a Supabase `error_diagnoses` row to the domain ErrorDiagnosis entity.
 */
export function toDomain(row: DiagnosisRow): ErrorDiagnosis {
  return {
    id: row.id,
    questionId: row.question_id,
    errorType: row.error_type as ErrorType,
    confidence: row.confidence,
    reasoning: row.reasoning,
    correction: row.correction,
    stepByStep: row.step_by_step,
    verificationResult: row.verification_result
      ? (row.verification_result as unknown as VerificationResult)
      : null,
    visualExplanation: row.visual_explanation
      ? (row.visual_explanation as unknown as VisualExplanation)
      : null,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain ErrorDiagnosis entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  diagnosis: Partial<Omit<ErrorDiagnosis, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (diagnosis.questionId !== undefined) row.question_id = diagnosis.questionId;
  if (diagnosis.errorType !== undefined) row.error_type = diagnosis.errorType;
  if (diagnosis.confidence !== undefined) row.confidence = diagnosis.confidence;
  if (diagnosis.reasoning !== undefined) row.reasoning = diagnosis.reasoning;
  if (diagnosis.correction !== undefined) row.correction = diagnosis.correction;
  if (diagnosis.stepByStep !== undefined) row.step_by_step = diagnosis.stepByStep;
  if (diagnosis.verificationResult !== undefined) {
    row.verification_result = diagnosis.verificationResult ?? null;
  }
  if (diagnosis.visualExplanation !== undefined) {
    row.visual_explanation = diagnosis.visualExplanation ?? null;
  }

  return row;
}
