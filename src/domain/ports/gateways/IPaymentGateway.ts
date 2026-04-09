import type { SubscriptionPlan } from '@/domain/value-objects';

export interface IPaymentGateway {
  createSession(userId: string, plan: SubscriptionPlan): Promise<{
    sessionId: string;
    redirectUrl: string;
  }>;
  verifyWebhook(payload: unknown): Promise<{
    userId: string;
    plan: SubscriptionPlan;
    status: 'success' | 'failed';
    transactionId: string;
  }>;
}
