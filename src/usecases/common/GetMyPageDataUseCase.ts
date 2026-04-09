import type { UseCase } from '@/shared/types';
import type { Credit, Subscription } from '@/domain/entities';
import type { ICreditRepository, ISubscriptionRepository } from '@/domain/ports/repositories';

export interface GetMyPageDataInput {
  userId: string;
}

export interface GetMyPageDataOutput {
  credit: Credit | null;
  subscription: Subscription | null;
}

/**
 * GetMyPageDataUseCase - Fetches credit and subscription info for "My Page".
 *
 * Runs both queries in parallel for performance. Either field can be null
 * if the user has no credit record or no active subscription.
 */
export class GetMyPageDataUseCase
  implements UseCase<GetMyPageDataInput, GetMyPageDataOutput>
{
  constructor(
    private readonly creditRepo: ICreditRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  async execute(input: GetMyPageDataInput): Promise<GetMyPageDataOutput> {
    const { userId } = input;

    // 크레딧과 구독 정보를 병렬로 조회
    const [credit, subscription] = await Promise.all([
      this.creditRepo.findByUserId(userId),
      this.subscriptionRepo.findActive(userId),
    ]);

    return { credit, subscription };
  }
}
