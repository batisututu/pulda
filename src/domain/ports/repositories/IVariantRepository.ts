import type { VariantQuestion } from '@/domain/entities';

export interface IVariantRepository {
  findByDiagnosisId(diagnosisId: string): Promise<VariantQuestion[]>;
  findByDiagnosisIds(diagnosisIds: string[]): Promise<VariantQuestion[]>;
  findByUserId(userId: string): Promise<VariantQuestion[]>;
  findByIds(ids: string[]): Promise<VariantQuestion[]>;
  create(variant: Omit<VariantQuestion, 'id' | 'createdAt'>): Promise<VariantQuestion>;
  createMany(variants: Omit<VariantQuestion, 'id' | 'createdAt'>[]): Promise<VariantQuestion[]>;
}
