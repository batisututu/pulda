import type { Follow } from '@/domain/entities';
import type { FollowStatus } from '@/domain/value-objects';

/**
 * Database row shape for the `follows` table (snake_case).
 */
export interface FollowRow {
  id: string;
  follower_id: string;
  following_id: string;
  status: string;
  created_at: string;
}

/**
 * Maps a Supabase `follows` row to the domain Follow entity.
 */
export function toDomain(row: FollowRow): Follow {
  return {
    id: row.id,
    followerId: row.follower_id,
    followingId: row.following_id,
    status: row.status as FollowStatus,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Follow entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  follow: Partial<Omit<Follow, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (follow.followerId !== undefined) row.follower_id = follow.followerId;
  if (follow.followingId !== undefined) row.following_id = follow.followingId;
  if (follow.status !== undefined) row.status = follow.status;

  return row;
}
