import type { QuestionCache } from '@/domain/entities';

export interface ICacheRepository {
  findByHash(contentHash: string): Promise<QuestionCache | null>;
  upsert(hash: string, data: Partial<QuestionCache>): Promise<QuestionCache>;
  incrementHitCount(id: string): Promise<void>;
}
