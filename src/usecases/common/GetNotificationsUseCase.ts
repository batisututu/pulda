import type { UseCase } from '@/shared/types';
import type { INotificationRepository } from '@/domain/ports/repositories';
import type { Notification } from '@/domain/entities';

export interface GetNotificationsInput {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
}

export interface GetNotificationsOutput {
  notifications: Notification[];
  unreadCount: number;
}

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 50;

export class GetNotificationsUseCase implements UseCase<GetNotificationsInput, GetNotificationsOutput> {
  constructor(
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: GetNotificationsInput): Promise<GetNotificationsOutput> {
    const { userId, unreadOnly } = input;

    // 1. Validate and cap limit
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // 2. Load notifications
    const notifications = await this.notificationRepo.findByUser(userId, {
      unreadOnly,
      limit,
    });

    // 3. Count unread (fetch unread-only if not already filtered)
    let unreadCount: number;
    if (unreadOnly) {
      unreadCount = notifications.length;
    } else {
      const unreadNotifications = await this.notificationRepo.findByUser(userId, {
        unreadOnly: true,
      });
      unreadCount = unreadNotifications.length;
    }

    return { notifications, unreadCount };
  }
}
