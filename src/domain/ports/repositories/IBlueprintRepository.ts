import type { Blueprint } from '@/domain/entities';

export interface IBlueprintRepository {
  findByExamId(examId: string): Promise<Blueprint | null>;
  findByExamIds(examIds: string[]): Promise<Blueprint[]>;
  create(blueprint: Omit<Blueprint, 'id' | 'createdAt'>): Promise<Blueprint>;
}
