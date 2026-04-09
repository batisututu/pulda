import type { UseCase } from '@/shared/types';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import type { FollowStatus } from '@/domain/value-objects';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';

export interface RespondToFollowInput {
  userId: string;
  followId: string;
  action: 'accept' | 'reject' | 'block';
}

export interface RespondToFollowOutput {
  followId: string;
  status: FollowStatus | 'deleted';
}

export class RespondToFollowUseCase implements UseCase<RespondToFollowInput, RespondToFollowOutput> {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: RespondToFollowInput): Promise<RespondToFollowOutput> {
    const { userId, followId, action } = input;

    // 1. Find follow request
    const follow = await this.followRepo.findById(followId);
    if (!follow) {
      throw new NotFoundError('Follow', followId);
    }

    // 2. Verify only the target user can respond
    if (follow.followingId !== userId) {
      throw new ForbiddenError('팔로우 요청에 응답할 권한이 없습니다');
    }

    // 3. Verify status is pending
    if (follow.status !== 'pending') {
      throw new ValidationError('대기 중인 팔로우 요청만 응답할 수 있습니다');
    }

    // 4. Handle action
    switch (action) {
      case 'accept': {
        await this.followRepo.updateStatus(followId, 'accepted');
        // Notify the follower
        await this.notificationRepo.create({
          userId: follow.followerId,
          type: 'follow_accepted',
          title: '팔로우 수락',
          body: '팔로우 요청이 수락되었습니다.',
          isRead: false,
          data: { followId, followingId: userId },
        });
        return { followId, status: 'accepted' };
      }

      case 'reject': {
        // Completely remove the follow record
        await this.followRepo.delete(followId);
        return { followId, status: 'deleted' };
      }

      case 'block': {
        await this.followRepo.updateStatus(followId, 'blocked');
        // No notification for block
        return { followId, status: 'blocked' };
      }
    }
  }
}
