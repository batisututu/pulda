import type { UseCase } from '@/shared/types';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { IUserRepository } from '@/domain/ports/repositories';

export interface GetPendingFollowsInput {
  userId: string;
}

/**
 * 팔로우 요청 목록의 단일 항목: 팔로워 ID, 닉네임, 요청 시각을 포함.
 */
export interface PendingFollowItem {
  id: string;
  followerId: string;
  followerNickname: string;
  createdAt: string;
}

export interface GetPendingFollowsOutput {
  pendingFollows: PendingFollowItem[];
}

export class GetPendingFollowsUseCase
  implements UseCase<GetPendingFollowsInput, GetPendingFollowsOutput>
{
  constructor(
    private readonly followRepo: IFollowRepository,
    private readonly userRepo: IUserRepository,
  ) {}

  async execute(input: GetPendingFollowsInput): Promise<GetPendingFollowsOutput> {
    const { userId } = input;

    // 1. 나에게 온 모든 팔로우 관계 조회 → pending 상태만 필터
    const allFollows = await this.followRepo.findByFollowing(userId);
    const pendingFollows = allFollows.filter((f) => f.status === 'pending');

    if (pendingFollows.length === 0) {
      return { pendingFollows: [] };
    }

    // 2. 팔로워 ID 목록으로 사용자 일괄 조회하여 닉네임 해소
    const followerIds = pendingFollows.map((f) => f.followerId);
    const users = await this.userRepo.findByIds(followerIds);

    // userId → nickname 맵 생성
    const nicknameMap = new Map<string, string>(
      users.map((u) => [u.id, u.nickname]),
    );

    const items: PendingFollowItem[] = pendingFollows.map((f) => ({
      id: f.id,
      followerId: f.followerId,
      // 닉네임을 찾을 수 없는 경우 기본값 처리
      followerNickname: nicknameMap.get(f.followerId) ?? '사용자',
      createdAt: f.createdAt,
    }));

    return { pendingFollows: items };
  }
}
