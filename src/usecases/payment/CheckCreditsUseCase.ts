import type { UseCase } from '@/shared/types';
import type { SubscriptionPlan } from '@/domain/value-objects';
import type { ICreditRepository } from '@/domain/ports/repositories';
import { getRemainingCredits, isResetDue } from '@/domain/rules/creditRules';
import { NotFoundError } from '@/shared/errors';

export interface CheckCreditsInput {
  userId: string;
}

export interface CheckCreditsOutput {
  total: number;
  used: number;
  remaining: number;
  plan: SubscriptionPlan;
  resetAt: string | null;
}

export class CheckCreditsUseCase implements UseCase<CheckCreditsInput, CheckCreditsOutput> {
  constructor(
    private readonly creditRepo: ICreditRepository,
  ) {}

  async execute(input: CheckCreditsInput): Promise<CheckCreditsOutput> {
    const { userId } = input;

    // 1. Fetch credit record
    let credit = await this.creditRepo.findByUserId(userId);
    if (!credit) {
      throw new NotFoundError('Credit', userId);
    }

    // 2. Check if reset is due and trigger reset if needed
    if (isResetDue(credit)) {
      credit = await this.creditRepo.reset(userId, credit.plan);
    }

    // 3. Calculate remaining credits
    const remaining = getRemainingCredits(credit);

    return {
      total: credit.total,
      used: credit.used,
      remaining,
      plan: credit.plan,
      resetAt: credit.resetAt,
    };
  }
}
