import type { UseCase } from '@/shared/types';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import type { FollowStatus } from '@/domain/value-objects';
import { ValidationError, ConflictError, NotFoundError } from '@/shared/errors';
import { canSelfFollow, canFollow } from '@/domain/rules/followRules';

export interface FollowUserInput {
  followerId: string;
  followingId: string;
}

export interface FollowUserOutput {
  followId: string;
  status: FollowStatus;
}

export class FollowUserUseCase implements UseCase<FollowUserInput, FollowUserOutput> {
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly userRepo: IUserRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: FollowUserInput): Promise<FollowUserOutput> {
    const { followerId, followingId } = input;

    // 1. Validate not self-follow
    if (!canSelfFollow(followerId, followingId)) {
      throw new ValidationError('자기 자신을 팔로우할 수 없습니다');
    }

    // 2. Check for existing follow relationship
    const existing = await this.followRepo.findBetween(followerId, followingId);
    if (existing) {
      throw new ConflictError('이미 팔로우 요청이 존재합니다');
    }

    // 3. Check following limit
    const currentCount = await this.followRepo.countFollowing(followerId);
    if (!canFollow(currentCount)) {
      throw new ValidationError('최대 팔로우 수(200명)를 초과했습니다');
    }

    // 4. Verify target user exists
    const targetUser = await this.userRepo.findById(followingId);
    if (!targetUser) {
      throw new NotFoundError('User', followingId);
    }

    // 5. Create follow with pending status
    const follow = await this.followRepo.create({
      followerId,
      followingId,
      status: 'pending',
    });

    // 6. Notify target user
    const followerUser = await this.userRepo.findById(followerId);
    await this.notificationRepo.create({
      userId: followingId,
      type: 'follow_request',
      title: '팔로우 요청',
      body: `${followerUser?.nickname ?? '사용자'}님이 팔로우를 요청했습니다.`,
      isRead: false,
      data: { followerId, followId: follow.id },
    });

    return {
      followId: follow.id,
      status: follow.status,
    };
  }
}
