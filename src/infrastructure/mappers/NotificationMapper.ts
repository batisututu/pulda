import type { Notification } from '@/domain/entities';

/**
 * Database row shape for the `notifications` table (snake_case).
 */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Maps a Supabase `notifications` row to the domain Notification entity.
 */
export function toDomain(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    data: row.data,
    createdAt: row.created_at,
  };
}

/**
 * Maps a (partial) domain Notification entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  notification: Partial<Omit<Notification, 'id' | 'createdAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (notification.userId !== undefined) row.user_id = notification.userId;
  if (notification.type !== undefined) row.type = notification.type;
  if (notification.title !== undefined) row.title = notification.title;
  if (notification.body !== undefined) row.body = notification.body;
  if (notification.isRead !== undefined) row.is_read = notification.isRead;
  if (notification.data !== undefined) row.data = notification.data;

  return row;
}
