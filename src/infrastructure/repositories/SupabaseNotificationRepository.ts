import type { SupabaseClient } from '@supabase/supabase-js';
import type { INotificationRepository } from '@/domain/ports/repositories/INotificationRepository';
import type { Notification } from '@/domain/entities';
import { toDomain, toPersistence, type NotificationRow } from '@/infrastructure/mappers/NotificationMapper';
import { repoError } from './_shared/repoError';

const DEFAULT_LIMIT = 50;

export class SupabaseNotificationRepository implements INotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Notification | null> {
    const { data, error } = await this.db
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as NotificationRow);
  }

  async findByUser(
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ): Promise<Notification[]> {
    let query = this.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? DEFAULT_LIMIT);

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) throw repoError('SupabaseNotificationRepository', 'findByUser', error, { userId });
    return (data as NotificationRow[]).map(toDomain);
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const row = toPersistence(notification);

    const { data, error } = await this.db
      .from('notifications')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw repoError('SupabaseNotificationRepository', 'create', error, { userId: notification.userId });
    }
    return toDomain(data as NotificationRow);
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw repoError('SupabaseNotificationRepository', 'markRead', error, { id });
  }

  async markAllRead(userId: string): Promise<void> {
    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw repoError('SupabaseNotificationRepository', 'markAllRead', error, { userId });
  }
}
