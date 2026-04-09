import type { Feedback } from '@/domain/entities';

/**
 * Database row shape for the `feedbacks` table (snake_case).
 */
export interface FeedbackRow {
  id: string;
  user_id: string;
  target_type: string;
  target_id: string;
  rating: number;
  created_at: string;
}

/**
 * Maps a Supabase `feedbacks` row to the domain Feedback entity.
 */
export function toDomain(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type as Feedback['targetType'],
    targetId: row.target_id,
    rating: row.rating as -1 | 1,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Feedback entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  feedback: Partial<Omit<Feedback, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (feedback.userId !== undefined) row.user_id = feedback.userId;
  if (feedback.targetType !== undefined) row.target_type = feedback.targetType;
  if (feedback.targetId !== undefined) row.target_id = feedback.targetId;
  if (feedback.rating !== undefined) row.rating = feedback.rating;

  return row;
}
