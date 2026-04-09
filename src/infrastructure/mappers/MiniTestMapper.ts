import type { MiniTest } from '@/domain/entities';

/**
 * Database row shape for the `mini_tests` table (snake_case).
 */
export interface MiniTestRow {
  id: string;
  user_id: string;
  variant_ids: string[];
  score: number | null;
  total_points: number | null;
  time_spent: number | null;
  completed_at: string | null;
  created_at: string;
}

/**
 * Maps a Supabase `mini_tests` row to the domain MiniTest entity.
 */
export function toDomain(row: MiniTestRow): MiniTest {
  return {
    id: row.id,
    userId: row.user_id,
    variantIds: row.variant_ids,
    score: row.score,
    totalPoints: row.total_points,
    timeSpent: row.time_spent,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain MiniTest entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  test: Partial<Omit<MiniTest, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (test.userId !== undefined) row.user_id = test.userId;
  if (test.variantIds !== undefined) row.variant_ids = test.variantIds;
  if (test.score !== undefined) row.score = test.score;
  if (test.totalPoints !== undefined) row.total_points = test.totalPoints;
  if (test.timeSpent !== undefined) row.time_spent = test.timeSpent;
  if (test.completedAt !== undefined) row.completed_at = test.completedAt;

  return row;
}
