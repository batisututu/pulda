import type { Credit } from '@/domain/entities';
import type { SubscriptionPlan } from '@/domain/value-objects';

export interface ICreditRepository {
  findByUserId(userId: string): Promise<Credit | null>;
  deduct(userId: string, amount: number): Promise<Credit>;
  reset(userId: string, plan: SubscriptionPlan): Promise<Credit>;
  update(userId: string, data: Partial<Credit>): Promise<Credit>;
}
