import type { UseCase } from '@/shared/types';
import type { SubscriptionPlan } from '@/domain/value-objects';
import type { ISubscriptionRepository } from '@/domain/ports/repositories';
import type { IPaymentGateway } from '@/domain/ports/gateways';
import { ValidationError } from '@/shared/errors';

export interface CreateSubscriptionInput {
  userId: string;
  plan: SubscriptionPlan;
}

export interface CreateSubscriptionOutput {
  sessionId: string;
  redirectUrl: string;
}

export class CreateSubscriptionUseCase implements UseCase<CreateSubscriptionInput, CreateSubscriptionOutput> {
  constructor(
    private readonly subscriptionRepo: ISubscriptionRepository,
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async execute(input: CreateSubscriptionInput): Promise<CreateSubscriptionOutput> {
    const { userId, plan } = input;

    if (plan === 'free' || plan === 'parent') {
      throw new ValidationError('Cannot subscribe to a free or parent plan');
    }

    // Check for existing active subscription
    const existing = await this.subscriptionRepo.findActive(userId);
    if (existing) {
      throw new ValidationError('User already has an active subscription');
    }

    // Create PortOne payment session
    const session = await this.paymentGateway.createSession(userId, plan);

    return {
      sessionId: session.sessionId,
      redirectUrl: session.redirectUrl,
    };
  }
}
