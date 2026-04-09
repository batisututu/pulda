import type { Subscription } from '@/domain/entities';
import type { SubscriptionPlan } from '@/domain/value-objects';

/**
 * Database row shape for the `subscriptions` table (snake_case).
 */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  portone_subscription_id: string | null;
  started_at: string;
  expires_at: string | null;
  created_at: string;
}

/**
 * Maps a Supabase `subscriptions` row to the domain Subscription entity.
 */
export function toDomain(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan as SubscriptionPlan,
    status: row.status as Subscription['status'],
    portoneSubscriptionId: row.portone_subscription_id,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Subscription entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  subscription: Partial<Omit<Subscription, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (subscription.userId !== undefined) row.user_id = subscription.userId;
  if (subscription.plan !== undefined) row.plan = subscription.plan;
  if (subscription.status !== undefined) row.status = subscription.status;
  if (subscription.portoneSubscriptionId !== undefined)
    row.portone_subscription_id = subscription.portoneSubscriptionId;
  if (subscription.startedAt !== undefined) row.started_at = subscription.startedAt;
  if (subscription.expiresAt !== undefined) row.expires_at = subscription.expiresAt;

  return row;
}
