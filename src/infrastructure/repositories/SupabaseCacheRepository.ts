import type { SupabaseClient } from '@supabase/supabase-js';
import type { ICacheRepository } from '@/domain/ports/repositories/ICacheRepository';
import type { QuestionCache } from '@/domain/entities';
import {
  toDomain,
  toPersistence,
  type CacheRow,
} from '@/infrastructure/mappers/CacheMapper';
import { repoError } from './_shared/repoError';

export class SupabaseCacheRepository implements ICacheRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByHash(contentHash: string): Promise<QuestionCache | null> {
    const { data, error } = await this.db
      .from('question_cache')
      .select('*')
      .eq('content_hash', contentHash)
      .single();

    if (error || !data) return null;
    return toDomain(data as CacheRow);
  }

  async upsert(
    hash: string,
    cacheData: Partial<QuestionCache>,
  ): Promise<QuestionCache> {
    const row = toPersistence({ ...cacheData, contentHash: hash });
    // content_hash는 upsert 충돌 키이므로 반드시 포함
    row.content_hash = hash;

    const { data, error } = await this.db
      .from('question_cache')
      .upsert(row, { onConflict: 'content_hash' })
      .select('*')
      .single();

    if (error || !data) {
      throw repoError(
        'SupabaseCacheRepository',
        'upsert',
        error ?? { message: 'Failed to upsert cache entry' },
        { hash },
      );
    }
    return toDomain(data as CacheRow);
  }

  async incrementHitCount(id: string): Promise<void> {
    // RPC 우선 시도; 실패 시 수동 read-then-update로 폴백
    const { error: rpcError } = await this.db.rpc('increment_hit_count', {
      row_id: id,
    });

    if (rpcError) {
      // 폴백: 현재 값 읽어서 수동으로 증가
      const { data, error: readError } = await this.db
        .from('question_cache')
        .select('hit_count')
        .eq('id', id)
        .single();

      if (readError || !data) {
        throw repoError(
          'SupabaseCacheRepository',
          'incrementHitCount',
          readError ?? { message: 'Cache entry not found for hit count increment' },
          { id },
        );
      }

      const currentCount = (data as { hit_count: number }).hit_count;

      const { error: updateError } = await this.db
        .from('question_cache')
        .update({ hit_count: currentCount + 1 })
        .eq('id', id);

      if (updateError) {
        throw repoError('SupabaseCacheRepository', 'incrementHitCount', updateError, { id });
      }
    }
  }
}
