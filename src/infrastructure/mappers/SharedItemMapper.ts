import type { SharedItem } from '@/domain/entities';
import type { FeedItem } from '@/domain/entities';

/**
 * Database row shape for the `shared_items` table (snake_case).
 */
export interface SharedItemRow {
  id: string;
  user_id: string;
  item_type: string;
  item_id: string;
  visibility: string;
  caption: string | null;
  created_at: string;
}

/**
 * Extended row shape for social feed queries (shared_items JOIN users).
 */
export interface FeedRow extends SharedItemRow {
  nickname: string;
  avatar_url: string | null;
}

/**
 * shared_items + users JOIN 결과를 FeedItem 도메인 엔티티로 변환.
 * Supabase 임베디드 리소스 조인: users!user_id(nickname, avatar_url)
 */
export function toDomainFeedItem(row: FeedRow): FeedItem {
  return {
    id: row.id,
    userId: row.user_id,
    itemType: row.item_type as SharedItem['itemType'],
    itemId: row.item_id,
    visibility: row.visibility as SharedItem['visibility'],
    caption: row.caption,
    createdAt: row.created_at,
    authorNickname: row.nickname ?? '사용자',
    authorAvatarUrl: row.avatar_url,
  };
}

/**
 * Maps a Supabase `shared_items` row to the domain SharedItem entity.
 */
export function toDomain(row: SharedItemRow): SharedItem {
  return {
    id: row.id,
    userId: row.user_id,
    itemType: row.item_type as SharedItem['itemType'],
    itemId: row.item_id,
    visibility: row.visibility as SharedItem['visibility'],
    caption: row.caption,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain SharedItem entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  item: Partial<Omit<SharedItem, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (item.userId !== undefined) row.user_id = item.userId;
  if (item.itemType !== undefined) row.item_type = item.itemType;
  if (item.itemId !== undefined) row.item_id = item.itemId;
  if (item.visibility !== undefined) row.visibility = item.visibility;
  if (item.caption !== undefined) row.caption = item.caption;

  return row;
}
