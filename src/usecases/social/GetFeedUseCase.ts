import type { UseCase } from '@/shared/types';
import type { ISharedItemRepository } from '@/domain/ports/repositories';
import type { FeedItem } from '@/domain/entities';
import { ValidationError } from '@/shared/errors';

export interface GetFeedInput {
  userId: string;
  page: number;
  limit: number;
}

export interface GetFeedOutput {
  // FeedItem에는 authorNickname, authorAvatarUrl이 포함되어 있어 스토어에서 별도 조회 불필요
  items: FeedItem[];
  hasMore: boolean;
}

const MAX_LIMIT = 50;

export class GetFeedUseCase implements UseCase<GetFeedInput, GetFeedOutput> {
  constructor(
    private readonly sharedItemRepo: ISharedItemRepository,
  ) {}

  async execute(input: GetFeedInput): Promise<GetFeedOutput> {
    const { userId, page, limit } = input;

    // 1. Validate pagination
    if (page < 1) {
      throw new ValidationError('페이지 번호는 1 이상이어야 합니다');
    }
    if (limit < 1 || limit > MAX_LIMIT) {
      throw new ValidationError(`항목 수는 1~${MAX_LIMIT} 사이여야 합니다`);
    }

    // 2. Fetch limit+1 items to determine hasMore
    const items = await this.sharedItemRepo.findFeed(userId, {
      page,
      limit: limit + 1,
    });

    const hasMore = items.length > limit;
    const resultItems = hasMore ? items.slice(0, limit) : items;

    return { items: resultItems, hasMore };
  }
}
