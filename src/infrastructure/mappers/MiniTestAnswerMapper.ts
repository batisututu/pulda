import type { MiniTestAnswer } from '@/domain/entities';

/**
 * Database row shape for the `mini_test_answers` table (snake_case).
 */
export interface MiniTestAnswerRow {
  id: string;
  test_id: string;
  variant_question_id: string;
  user_answer: string | null;
  is_correct: boolean | null;
  time_spent: number | null;
  created_at: string;
}

/**
 * Maps a Supabase `mini_test_answers` row to the domain MiniTestAnswer entity.
 */
export function toDomain(row: MiniTestAnswerRow): MiniTestAnswer {
  return {
    id: row.id,
    testId: row.test_id,
    variantQuestionId: row.variant_question_id,
    userAnswer: row.user_answer,
    isCorrect: row.is_correct,
    timeSpent: row.time_spent,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain MiniTestAnswer entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  answer: Partial<Omit<MiniTestAnswer, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (answer.testId !== undefined) row.test_id = answer.testId;
  if (answer.variantQuestionId !== undefined) row.variant_question_id = answer.variantQuestionId;
  if (answer.userAnswer !== undefined) row.user_answer = answer.userAnswer;
  if (answer.isCorrect !== undefined) row.is_correct = answer.isCorrect;
  if (answer.timeSpent !== undefined) row.time_spent = answer.timeSpent;

  return row;
}
