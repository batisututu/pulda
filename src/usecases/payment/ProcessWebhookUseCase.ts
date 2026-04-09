import type { UseCase } from '@/shared/types';
import type { Subscription } from '@/domain/entities';
import type { ISubscriptionRepository, ICreditRepository } from '@/domain/ports/repositories';
import type { IPaymentGateway } from '@/domain/ports/gateways';
import { getPlanLimit } from '@/domain/rules/creditRules';
import { ValidationError } from '@/shared/errors';

export interface ProcessWebhookInput {
  payload: unknown;
}

export interface ProcessWebhookOutput {
  subscription: Subscription;
  creditsReset: boolean;
}

export class ProcessWebhookUseCase implements UseCase<ProcessWebhookInput, ProcessWebhookOutput> {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly creditRepo: ICreditRepository,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(input: ProcessWebhookInput): Promise<ProcessWebhookOutput> {
    const { payload } = input;

    // Verify webhook and extract payment info
    const result = await this.paymentGateway.verifyWebhook(payload);

    if (result.status !== 'success') {
      throw new ValidationError(`Payment failed for transaction ${result.transactionId}`);
    }

    // Cancel any existing active subscription
    const existing = await this.subscriptionRepo.findActive(result.userId);
    if (existing) {
      await this.subscriptionRepo.cancel(existing.id);
    }

    // Calculate subscription expiry
    const now = new Date();
    const expiresAt = new Date(now);
    if (result.plan === 'season_pass') {
      expiresAt.setDate(expiresAt.getDate() + 14); // 2 weeks
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month
    }

    // Create new subscription
    const subscription = await this.subscriptionRepo.create({
      userId: result.userId,
      plan: result.plan,
      status: 'active',
      portoneSubscriptionId: result.transactionId,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    // Reset credits for new plan
    await this.creditRepo.reset(result.userId, result.plan);

    return {
      subscription,
      creditsReset: true,
    };
  }
}
