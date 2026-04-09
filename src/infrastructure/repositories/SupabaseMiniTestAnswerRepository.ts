import type { SupabaseClient } from '@supabase/supabase-js';
import type { IMiniTestAnswerRepository } from '@/domain/ports/repositories/IMiniTestAnswerRepository';
import type { MiniTestAnswer } from '@/domain/entities';
import { toDomain, toPersistence, type MiniTestAnswerRow } from '@/infrastructure/mappers/MiniTestAnswerMapper';
import { repoError } from './_shared/repoError';

export class SupabaseMiniTestAnswerRepository implements IMiniTestAnswerRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByTestId(testId: string): Promise<MiniTestAnswer[]> {
    const { data, error } = await this.db
      .from('mini_test_answers')
      .select('*')
      .eq('test_id', testId)
      .order('created_at', { ascending: true });

    if (error) throw repoError('SupabaseMiniTestAnswerRepository', 'findByTestId', error, { testId });
    return (data as MiniTestAnswerRow[]).map(toDomain);
  }

  async findByTestIds(testIds: string[]): Promise<MiniTestAnswer[]> {
    if (testIds.length === 0) return [];

    const { data, error } = await this.db
      .from('mini_test_answers')
      .select('*')
      .in('test_id', testIds)
      .order('created_at', { ascending: true });

    if (error) throw repoError('SupabaseMiniTestAnswerRepository', 'findByTestIds', error, { count: testIds.length });
    return (data as MiniTestAnswerRow[]).map(toDomain);
  }

  async createMany(answers: Omit<MiniTestAnswer, 'id' | 'createdAt'>[]): Promise<MiniTestAnswer[]> {
    const rows = answers.map(toPersistence);

    const { data, error } = await this.db
      .from('mini_test_answers')
      .insert(rows)
      .select('*');

    if (error) {
      throw repoError('SupabaseMiniTestAnswerRepository', 'createMany', error, { count: answers.length });
    }
    return (data as MiniTestAnswerRow[]).map(toDomain);
  }
}
