import type { SubscriptionPlan } from '../value-objects/SubscriptionPlan';

/**
 * User subscription record tied to a payment plan.
 */
export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  portoneSubscriptionId: string | null;
  startedAt: string;              // ISO 8601
  expiresAt: string | null;       // ISO 8601
  createdAt: string;              // ISO 8601
}
