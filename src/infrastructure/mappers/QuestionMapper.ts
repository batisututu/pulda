import type { Question } from '@/domain/entities';
import type { QuestionType, SubjectOrOther } from '@/domain/value-objects';

/**
 * Database row shape for the `questions` table (snake_case).
 */
export interface QuestionRow {
  id: string;
  exam_id: string;
  subject: string;
  number: number;
  content: string;
  question_type: string;
  options: string[] | null;
  answer: string | null;
  student_answer: string | null;
  is_correct: boolean | null;
  points: number | null;
  created_at: string;
}

/**
 * Maps a Supabase `questions` row to the domain Question entity.
 */
export function toDomain(row: QuestionRow): Question {
  return {
    id: row.id,
    examId: row.exam_id,
    subject: row.subject as SubjectOrOther,
    number: row.number,
    content: row.content,
    questionType: row.question_type as QuestionType,
    options: row.options,
    answer: row.answer,
    studentAnswer: row.student_answer,
    isCorrect: row.is_correct,
    points: row.points,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Question entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  question: Partial<Omit<Question, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (question.examId !== undefined) row.exam_id = question.examId;
  if (question.subject !== undefined) row.subject = question.subject;
  if (question.number !== undefined) row.number = question.number;
  if (question.content !== undefined) row.content = question.content;
  if (question.questionType !== undefined) row.question_type = question.questionType;
  if (question.options !== undefined) row.options = question.options;
  if (question.answer !== undefined) row.answer = question.answer;
  if (question.studentAnswer !== undefined) row.student_answer = question.studentAnswer;
  if (question.isCorrect !== undefined) row.is_correct = question.isCorrect;
  if (question.points !== undefined) row.points = question.points;

  return row;
}
