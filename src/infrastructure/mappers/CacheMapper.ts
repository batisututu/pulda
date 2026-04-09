import type { QuestionCache, ClassificationResult, ExplanationResult } from '@/domain/entities';

/**
 * Database row shape for the `question_cache` table (snake_case).
 */
export interface CacheRow {
  id: string;
  content_hash: string;
  classification: Record<string, unknown> | null;
  explanation: Record<string, unknown> | null;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a Supabase `question_cache` row to the domain QuestionCache entity.
 */
export function toDomain(row: CacheRow): QuestionCache {
  return {
    id: row.id,
    contentHash: row.content_hash,
    classification: row.classification as ClassificationResult | null,
    explanation: row.explanation as ExplanationResult | null,
    hitCount: row.hit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a (partial) domain QuestionCache entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  cache: Partial<Omit<QuestionCache, 'id' | 'createdAt' | 'updatedAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (cache.contentHash !== undefined) row.content_hash = cache.contentHash;
  if (cache.classification !== undefined) {
    row.classification = cache.classification
      ? structuredClone(cache.classification)
      : null;
  }
  if (cache.explanation !== undefined) {
    row.explanation = cache.explanation
      ? structuredClone(cache.explanation)
      : null;
  }
  if (cache.hitCount !== undefined) row.hit_count = cache.hitCount;

  return row;
}
