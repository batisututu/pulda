import type { Credit } from '@/domain/entities';
import type { SubscriptionPlan } from '@/domain/value-objects';

/**
 * Database row shape for the `credits` table (snake_case).
 */
export interface CreditRow {
  id: string;
  user_id: string;
  plan: string;
  total: number;
  used: number;
  reset_at: string;
}

/**
 * Maps a Supabase `credits` row to the domain Credit entity.
 */
export function toDomain(row: CreditRow): Credit {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan as SubscriptionPlan,
    total: row.total,
    used: row.used,
    resetAt: row.reset_at,
  };
}

/**
 * Maps a (partial) domain Credit entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  credit: Partial<Omit<Credit, 'id'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (credit.userId !== undefined) row.user_id = credit.userId;
  if (credit.plan !== undefined) row.plan = credit.plan;
  if (credit.total !== undefined) row.total = credit.total;
  if (credit.used !== undefined) row.used = credit.used;
  if (credit.resetAt !== undefined) row.reset_at = credit.resetAt;

  return row;
}
