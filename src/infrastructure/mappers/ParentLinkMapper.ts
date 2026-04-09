import type { ParentLink } from '@/domain/entities';

/**
 * Database row shape for the `parent_links` table (snake_case).
 */
export interface ParentLinkRow {
  id: string;
  parent_user_id: string | null;
  child_user_id: string;
  link_code: string | null;
  status: string;
  linked_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

/**
 * Maps a Supabase `parent_links` row to the domain ParentLink entity.
 */
export function toDomain(row: ParentLinkRow): ParentLink {
  return {
    id: row.id,
    parentUserId: row.parent_user_id,
    childUserId: row.child_user_id,
    linkCode: row.link_code,
    status: row.status as ParentLink['status'],
    linkedAt: row.linked_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain ParentLink entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  link: Partial<Omit<ParentLink, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (link.parentUserId !== undefined) row.parent_user_id = link.parentUserId;
  if (link.childUserId !== undefined) row.child_user_id = link.childUserId;
  if (link.linkCode !== undefined) row.link_code = link.linkCode;
  if (link.status !== undefined) row.status = link.status;
  if (link.linkedAt !== undefined) row.linked_at = link.linkedAt;
  if (link.revokedAt !== undefined) row.revoked_at = link.revokedAt;

  return row;
}
