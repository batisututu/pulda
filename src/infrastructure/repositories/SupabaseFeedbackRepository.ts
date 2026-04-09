import type { SupabaseClient } from '@supabase/supabase-js';
import type { IFeedbackRepository } from '@/domain/ports/repositories/IFeedbackRepository';
import type { Feedback } from '@/domain/entities';
import { toDomain, toPersistence, type FeedbackRow } from '@/infrastructure/mappers/FeedbackMapper';
import { repoError } from './_shared/repoError';

export class SupabaseFeedbackRepository implements IFeedbackRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByTarget(
    targetType: string,
    targetId: string,
    userId: string,
  ): Promise<Feedback | null> {
    const { data, error } = await this.db
      .from('feedbacks')
      .select('*')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return toDomain(data as FeedbackRow);
  }

  async upsert(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback> {
    const row = toPersistence(feedback);

    const { data, error } = await this.db
      .from('feedbacks')
      .upsert(row, { onConflict: 'user_id,target_type,target_id' })
      .select('*')
      .single();

    if (error) {
      throw repoError('SupabaseFeedbackRepository', 'upsert', error, {
        userId: feedback.userId,
        targetId: feedback.targetId,
      });
    }
    return toDomain(data as FeedbackRow);
  }
}
