import type { SupabaseClient } from '@supabase/supabase-js';
import type { IUserRepository } from '@/domain/ports/repositories/IUserRepository';
import type { User } from '@/domain/entities';
import { toDomain, toPersistence, type UserRow } from '@/infrastructure/mappers/UserMapper';
import { repoError } from './_shared/repoError';

export class SupabaseUserRepository implements IUserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as UserRow);
  }

  async findByAuthId(authId: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();

    if (error || !data) return null;
    return toDomain(data as UserRow);
  }

  async findByNickname(query: string, limit: number = 20): Promise<User[]> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .ilike('nickname', `%${query}%`)
      .limit(limit);

    if (error) throw repoError('SupabaseUserRepository', 'findByNickname', error, { query });
    return (data as UserRow[]).map(toDomain);
  }

  async findByIds(ids: string[]): Promise<User[]> {
    // 빈 배열이면 DB 쿼리 없이 빈 결과 반환
    if (ids.length === 0) return [];

    const { data, error } = await this.db
      .from('users')
      .select('*')
      .in('id', ids);

    if (error) throw repoError('SupabaseUserRepository', 'findByIds', error, { count: ids.length });
    return (data as UserRow[]).map(toDomain);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const row = toPersistence(data);

    const { data: updated, error } = await this.db
      .from('users')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseUserRepository', 'update', error, { id });
    return toDomain(updated as UserRow);
  }
}
