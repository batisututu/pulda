import type { Notification } from '@/domain/entities';

export interface INotificationRepository {
  findById(id: string): Promise<Notification | null>;
  findByUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}
