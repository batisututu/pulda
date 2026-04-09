import type { SupabaseClient } from '@supabase/supabase-js';
import type { IVariantRepository } from '@/domain/ports/repositories/IVariantRepository';
import type { VariantQuestion } from '@/domain/entities';
import {
  toDomain,
  toPersistence,
  type VariantRow,
} from '@/infrastructure/mappers/VariantMapper';
import { repoError } from './_shared/repoError';

export class SupabaseVariantRepository implements IVariantRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByDiagnosisId(diagnosisId: string): Promise<VariantQuestion[]> {
    const { data, error } = await this.db
      .from('variant_questions')
      .select('*')
      .eq('diagnosis_id', diagnosisId);

    if (error) throw repoError('SupabaseVariantRepository', 'findByDiagnosisId', error, { diagnosisId });
    if (!data) return [];

    return data.map((row) => toDomain(row as unknown as VariantRow));
  }

  async findByDiagnosisIds(diagnosisIds: string[]): Promise<VariantQuestion[]> {
    if (diagnosisIds.length === 0) return [];

    const { data, error } = await this.db
      .from('variant_questions')
      .select('*')
      .in('diagnosis_id', diagnosisIds);

    if (error) {
      throw repoError('SupabaseVariantRepository', 'findByDiagnosisIds', error, { count: diagnosisIds.length });
    }
    if (!data) return [];
    return data.map((row) => toDomain(row as unknown as VariantRow));
  }

  async findByUserId(userId: string): Promise<VariantQuestion[]> {
    const { data, error } = await this.db
      .from('variant_questions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseVariantRepository', 'findByUserId', error, { userId });
    if (!data) return [];

    return data.map((row) => toDomain(row as unknown as VariantRow));
  }

  async findByIds(ids: string[]): Promise<VariantQuestion[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.db
      .from('variant_questions')
      .select('*')
      .in('id', ids);

    if (error) throw repoError('SupabaseVariantRepository', 'findByIds', error, { count: ids.length });
    if (!data) return [];

    return data.map((row) => toDomain(row as unknown as VariantRow));
  }

  async create(
    variant: Omit<VariantQuestion, 'id' | 'createdAt'>,
  ): Promise<VariantQuestion> {
    const row = toPersistence(variant);

    const { data, error } = await this.db
      .from('variant_questions')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw repoError(
        'SupabaseVariantRepository',
        'create',
        error ?? { message: 'Failed to create variant question' },
        { diagnosisId: variant.diagnosisId },
      );
    }
    return toDomain(data as VariantRow);
  }

  async createMany(
    variants: Omit<VariantQuestion, 'id' | 'createdAt'>[],
  ): Promise<VariantQuestion[]> {
    if (variants.length === 0) return [];

    const rows = variants.map((v) => toPersistence(v));

    const { data, error } = await this.db
      .from('variant_questions')
      .insert(rows)
      .select('*');

    if (error || !data) {
      throw repoError(
        'SupabaseVariantRepository',
        'createMany',
        error ?? { message: 'Failed to create variant questions' },
        { count: variants.length },
      );
    }
    return data.map((row) => toDomain(row as unknown as VariantRow));
  }
}
