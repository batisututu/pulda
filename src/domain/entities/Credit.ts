import type { SubscriptionPlan } from '../value-objects/SubscriptionPlan';

/**
 * Credit balance tracking for a user's current subscription period.
 */
export interface Credit {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  total: number;                  // max questions for current period
  used: number;                   // questions used
  resetAt: string;                // ISO 8601, next reset date
}
