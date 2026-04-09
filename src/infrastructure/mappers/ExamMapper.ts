import type { Exam, OcrResult } from '@/domain/entities';
import type { ExamStatus, SubjectOrOther, ServiceTier } from '@/domain/value-objects';

/**
 * Database row shape for the `exams` table (snake_case).
 */
export interface ExamRow {
  id: string;
  user_id: string;
  subject: string;
  service_tier: string;
  image_url: string | null;
  ocr_result: Record<string, unknown> | null;
  status: string;
  created_at: string;
  expires_at: string;
}

/**
 * Maps a Supabase `exams` row to the domain Exam entity.
 */
export function toDomain(row: ExamRow): Exam {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject as SubjectOrOther,
    serviceTier: row.service_tier as ServiceTier,
    imageUrl: row.image_url,
    ocrResult: row.ocr_result as OcrResult | null,
    status: row.status as ExamStatus,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Maps a (partial) domain Exam entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  exam: Partial<Omit<Exam, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (exam.userId !== undefined) row.user_id = exam.userId;
  if (exam.subject !== undefined) row.subject = exam.subject;
  if (exam.serviceTier !== undefined) row.service_tier = exam.serviceTier;
  if (exam.imageUrl !== undefined) row.image_url = exam.imageUrl;
  if (exam.ocrResult !== undefined) {
    row.ocr_result = exam.ocrResult ? structuredClone(exam.ocrResult) : null;
  }
  if (exam.status !== undefined) row.status = exam.status;
  if (exam.expiresAt !== undefined) row.expires_at = exam.expiresAt;

  return row;
}
