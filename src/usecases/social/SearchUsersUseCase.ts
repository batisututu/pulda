import type { UseCase } from '@/shared/types';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { FollowStatus } from '@/domain/value-objects';
import { ValidationError } from '@/shared/errors';

export interface SearchUsersInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface SearchUserResult {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  grade: string | null;
  followStatus: FollowStatus | null;
  followId: string | null;
}

export interface SearchUsersOutput {
  users: SearchUserResult[];
}

const DEFAULT_LIMIT = 10;

export class SearchUsersUseCase implements UseCase<SearchUsersInput, SearchUsersOutput> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly followRepo: IFollowRepository,
  ) {}

  async execute(input: SearchUsersInput): Promise<SearchUsersOutput> {
    const { userId, query, limit = DEFAULT_LIMIT } = input;

    // 1. Validate query length
    if (query.length < 2) {
      throw new ValidationError('검색어는 2자 이상이어야 합니다');
    }

    // 2. Search users by nickname
    const foundUsers = await this.userRepo.findByNickname(query, limit + 1);

    // 3. Exclude self and cap results
    const filteredUsers = foundUsers
      .filter((u) => u.id !== userId)
      .slice(0, limit);

    // 4. 배치 조회로 N+1 문제 해결 — 팔로우 상태 한 번에 조회
    const filteredUserIds = filteredUsers.map((u) => u.id);
    const follows = await this.followRepo.findBetweenMany(userId, filteredUserIds);
    const followMap = new Map(follows.map((f) => [f.followingId, f]));

    const users: SearchUserResult[] = filteredUsers.map((user) => {
      const follow = followMap.get(user.id);
      return {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        grade: user.grade,
        followStatus: follow?.status ?? null,
        followId: follow?.id ?? null,
      };
    });

    return { users };
  }
}
