import type { Subscription } from '@/domain/entities';

export interface ISubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>;
  findActive(userId: string): Promise<Subscription | null>;
  create(sub: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription>;
  cancel(id: string): Promise<void>;
}
