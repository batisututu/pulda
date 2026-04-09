import type { SupabaseClient } from '@supabase/supabase-js';
import type { ICreditRepository } from '@/domain/ports/repositories/ICreditRepository';
import type { Credit } from '@/domain/entities';
import type { SubscriptionPlan } from '@/domain/value-objects';
import { getPlanLimit } from '@/domain/rules';
import { InsufficientCreditsError } from '@/shared/errors';
import { toDomain, toPersistence, type CreditRow } from '@/infrastructure/mappers/CreditMapper';
import { repoError } from './_shared/repoError';

export class SupabaseCreditRepository implements ICreditRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByUserId(userId: string): Promise<Credit | null> {
    const { data, error } = await this.db
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return toDomain(data as CreditRow);
  }

  async deduct(userId: string, amount: number): Promise<Credit> {
    // 원자적 크레딧 차감 — RPC로 동시성 문제 방지
    const { data, error } = await this.db
      .rpc('deduct_credits', { p_user_id: userId, p_amount: amount });

    if (error) throw repoError('SupabaseCreditRepository', 'deduct', error, { userId, amount });

    // RPC 결과가 빈 배열이면 잔액 부족
    const rows = data as CreditRow[] | null;
    if (!rows || rows.length === 0) {
      // 현재 잔액 조회 후 구체적 에러 발생
      const current = await this.findByUserId(userId);
      const available = current ? current.total - current.used : 0;
      throw new InsufficientCreditsError(amount, available);
    }

    return toDomain(rows[0]);
  }

  async reset(userId: string, plan: SubscriptionPlan): Promise<Credit> {
    const total = getPlanLimit(plan);

    const { data, error } = await this.db
      .from('credits')
      .update({ plan, total, used: 0 })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseCreditRepository', 'reset', error, { userId, plan });
    return toDomain(data as CreditRow);
  }

  async update(userId: string, data: Partial<Credit>): Promise<Credit> {
    const row = toPersistence(data);

    const { data: updated, error } = await this.db
      .from('credits')
      .update(row)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseCreditRepository', 'update', error, { userId });
    return toDomain(updated as CreditRow);
  }
}
