import type { SupabaseClient } from '@supabase/supabase-js';
import type { IMiniTestRepository } from '@/domain/ports/repositories/IMiniTestRepository';
import type { MiniTest } from '@/domain/entities';
import { toDomain, toPersistence, type MiniTestRow } from '@/infrastructure/mappers/MiniTestMapper';
import { repoError } from './_shared/repoError';

export class SupabaseMiniTestRepository implements IMiniTestRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<MiniTest | null> {
    const { data, error } = await this.db
      .from('mini_tests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as MiniTestRow);
  }

  async findByUserId(userId: string): Promise<MiniTest[]> {
    const { data, error } = await this.db
      .from('mini_tests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseMiniTestRepository', 'findByUserId', error, { userId });
    return (data as MiniTestRow[]).map(toDomain);
  }

  async create(test: Omit<MiniTest, 'id' | 'createdAt'>): Promise<MiniTest> {
    const row = toPersistence(test);

    const { data, error } = await this.db
      .from('mini_tests')
      .insert(row)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseMiniTestRepository', 'create', error, { userId: test.userId });
    return toDomain(data as MiniTestRow);
  }

  async update(id: string, data: Partial<MiniTest>): Promise<MiniTest> {
    const row = toPersistence(data);

    const { data: updated, error } = await this.db
      .from('mini_tests')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseMiniTestRepository', 'update', error, { id });
    return toDomain(updated as MiniTestRow);
  }
}
