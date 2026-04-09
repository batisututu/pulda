import type { UseCase } from '@/shared/types';
import type { ISharedItemRepository } from '@/domain/ports/repositories';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import { ForbiddenError, ValidationError } from '@/shared/errors';
import { isOriginalExam, isShareable } from '@/domain/rules/sharingRules';

export interface ShareItemInput {
  userId: string;
  itemType: string;
  itemId: string;
  visibility: 'followers_only' | 'public';
  caption?: string;
}

export interface ShareItemOutput {
  sharedItemId: string;
}

export class ShareItemUseCase implements UseCase<ShareItemInput, ShareItemOutput> {
  constructor(
    private readonly sharedItemRepo: ISharedItemRepository,
    private readonly followRepo: IFollowRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: ShareItemInput): Promise<ShareItemOutput> {
    const { userId, itemType, itemId, visibility, caption } = input;

    // 1. Validate item type
    if (isOriginalExam(itemType)) {
      throw new ForbiddenError('원본 시험지는 공유할 수 없습니다');
    }

    if (!isShareable(itemType)) {
      throw new ValidationError('공유할 수 없는 항목 유형입니다');
    }

    // 2. Create shared item
    const sharedItem = await this.sharedItemRepo.create({
      userId,
      itemType: itemType as 'variant_set' | 'error_note' | 'mini_test_result' | 'blueprint',
      itemId,
      visibility,
      caption: caption ?? null,
    });

    // 3. Notify accepted followers (fire-and-forget)
    this.notifyFollowers(userId, sharedItem.id).catch(() => {});

    return { sharedItemId: sharedItem.id };
  }

  private async notifyFollowers(userId: string, sharedItemId: string): Promise<void> {
    const followers = await this.followRepo.findByFollowing(userId);
    const acceptedFollowers = followers.filter((f) => f.status === 'accepted');

    const notifications = acceptedFollowers.map((follower) =>
      this.notificationRepo.create({
        userId: follower.followerId,
        type: 'new_share',
        title: '새로운 공유',
        body: '팔로우 중인 사용자가 새로운 항목을 공유했습니다.',
        isRead: false,
        data: { sharedItemId, sharedBy: userId },
      }),
    );

    await Promise.allSettled(notifications);
  }
}
