import type { VariantQuestion, VariantVerificationResult } from '@/domain/entities';
import type { QuestionType, Difficulty, ErrorType, BloomLevel, VisualExplanation } from '@/domain/value-objects';

/**
 * Database row shape for the `variant_questions` table (snake_case).
 */
export interface VariantRow {
  id: string;
  diagnosis_id: string | null;
  content: string;
  question_type: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  difficulty: string;
  target_error_type: string | null;
  user_id: string | null;
  topic: string | null;
  grade: string | null;
  bloom_level: string | null;
  trap_point: string | null;
  target_time_seconds: number | null;
  verification_result: Record<string, unknown> | null;
  visual_explanation: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Maps a Supabase `variant_questions` row to the domain VariantQuestion entity.
 */
export function toDomain(row: VariantRow): VariantQuestion {
  return {
    id: row.id,
    diagnosisId: row.diagnosis_id ?? null,
    content: row.content,
    questionType: row.question_type as QuestionType,
    options: row.options,
    answer: row.answer,
    explanation: row.explanation,
    difficulty: row.difficulty as Difficulty,
    targetErrorType: row.target_error_type as ErrorType | null,
    userId: row.user_id ?? null,
    topic: row.topic ?? null,
    grade: row.grade ?? null,
    bloomLevel: (row.bloom_level as BloomLevel) ?? null,
    trapPoint: row.trap_point ?? null,
    targetTimeSeconds: row.target_time_seconds ?? null,
    verification: row.verification_result ? (row.verification_result as unknown as VariantVerificationResult) : null,
    visualExplanation: row.visual_explanation ? (row.visual_explanation as unknown as VisualExplanation) : null,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain VariantQuestion entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  variant: Partial<Omit<VariantQuestion, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (variant.diagnosisId !== undefined) row.diagnosis_id = variant.diagnosisId;
  if (variant.content !== undefined) row.content = variant.content;
  if (variant.questionType !== undefined) row.question_type = variant.questionType;
  if (variant.options !== undefined) row.options = variant.options;
  if (variant.answer !== undefined) row.answer = variant.answer;
  if (variant.explanation !== undefined) row.explanation = variant.explanation;
  if (variant.difficulty !== undefined) row.difficulty = variant.difficulty;
  if (variant.targetErrorType !== undefined) row.target_error_type = variant.targetErrorType;
  if (variant.userId !== undefined) row.user_id = variant.userId;
  if (variant.topic !== undefined) row.topic = variant.topic;
  if (variant.grade !== undefined) row.grade = variant.grade;
  if (variant.bloomLevel !== undefined) row.bloom_level = variant.bloomLevel;
  if (variant.trapPoint !== undefined) row.trap_point = variant.trapPoint;
  if (variant.targetTimeSeconds !== undefined) row.target_time_seconds = variant.targetTimeSeconds;
  if (variant.verification !== undefined) row.verification_result = variant.verification as unknown as Record<string, unknown>;
  if (variant.visualExplanation !== undefined) row.visual_explanation = variant.visualExplanation as unknown as Record<string, unknown> ?? null;

  return row;
}
