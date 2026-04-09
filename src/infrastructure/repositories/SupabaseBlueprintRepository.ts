import type { SupabaseClient } from '@supabase/supabase-js';
import type { IBlueprintRepository } from '@/domain/ports/repositories/IBlueprintRepository';
import type { Blueprint } from '@/domain/entities';
import {
  toDomain,
  toPersistence,
  type BlueprintRow,
} from '@/infrastructure/mappers/BlueprintMapper';
import { repoError } from './_shared/repoError';

export class SupabaseBlueprintRepository implements IBlueprintRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByExamId(examId: string): Promise<Blueprint | null> {
    const { data, error } = await this.db
      .from('blueprints')
      .select('*')
      .eq('exam_id', examId)
      .single();

    if (error || !data) return null;
    return toDomain(data as BlueprintRow);
  }

  async findByExamIds(examIds: string[]): Promise<Blueprint[]> {
    if (examIds.length === 0) return [];

    const { data, error } = await this.db
      .from('blueprints')
      .select('*')
      .in('exam_id', examIds);

    if (error) throw repoError('SupabaseBlueprintRepository', 'findByExamIds', error, { examIds });
    if (!data) return [];
    return (data as BlueprintRow[]).map(toDomain);
  }

  async create(
    blueprint: Omit<Blueprint, 'id' | 'createdAt'>,
  ): Promise<Blueprint> {
    const row = toPersistence(blueprint);

    const { data, error } = await this.db
      .from('blueprints')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw repoError(
        'SupabaseBlueprintRepository',
        'create',
        error ?? { message: 'Failed to create blueprint' },
        { examId: blueprint.examId },
      );
    }
    return toDomain(data as BlueprintRow);
  }
}
