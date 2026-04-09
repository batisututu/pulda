import type { UseCase } from '@/shared/types';
import type { INotificationRepository } from '@/domain/ports/repositories';
import { ForbiddenError, NotFoundError } from '@/shared/errors';

export interface MarkNotificationReadInput {
  userId: string;
  notificationId?: string;
}

export interface MarkNotificationReadOutput {
  success: boolean;
}

export class MarkNotificationReadUseCase implements UseCase<MarkNotificationReadInput, MarkNotificationReadOutput> {
  constructor(
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: MarkNotificationReadInput): Promise<MarkNotificationReadOutput> {
    const { userId, notificationId } = input;

    if (notificationId) {
      // Verify ownership before marking as read
      const notification = await this.notificationRepo.findById(notificationId);
      if (!notification) {
        throw new NotFoundError('Notification', notificationId);
      }
      if (notification.userId !== userId) {
        throw new ForbiddenError('이 알림에 대한 접근 권한이 없습니다');
      }
      // Mark a single notification as read
      await this.notificationRepo.markRead(notificationId);
    } else {
      // Mark all notifications as read for this user
      await this.notificationRepo.markAllRead(userId);
    }

    return { success: true };
  }
}
