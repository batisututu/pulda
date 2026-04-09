import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISubscriptionRepository } from '@/domain/ports/repositories/ISubscriptionRepository';
import type { Subscription } from '@/domain/entities';
import { toDomain, toPersistence, type SubscriptionRow } from '@/infrastructure/mappers/SubscriptionMapper';
import { repoError } from './_shared/repoError';

export class SupabaseSubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return toDomain(data as SubscriptionRow);
  }

  async findActive(userId: string): Promise<Subscription | null> {
    const { data, error } = await this.db
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return toDomain(data as SubscriptionRow);
  }

  async create(sub: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription> {
    const row = toPersistence(sub);

    const { data, error } = await this.db
      .from('subscriptions')
      .insert(row)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseSubscriptionRepository', 'create', error, { userId: sub.userId });
    return toDomain(data as SubscriptionRow);
  }

  async cancel(id: string): Promise<void> {
    const { error } = await this.db
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw repoError('SupabaseSubscriptionRepository', 'cancel', error, { id });
  }
}
