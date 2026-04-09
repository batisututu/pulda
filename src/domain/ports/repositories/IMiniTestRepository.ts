import type { MiniTest } from '@/domain/entities';

export interface IMiniTestRepository {
  findById(id: string): Promise<MiniTest | null>;
  findByUserId(userId: string): Promise<MiniTest[]>;
  create(test: Omit<MiniTest, 'id' | 'createdAt'>): Promise<MiniTest>;
  update(id: string, data: Partial<MiniTest>): Promise<MiniTest>;
}
