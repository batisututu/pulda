import type { MiniTestAnswer } from '@/domain/entities';

export interface IMiniTestAnswerRepository {
  findByTestId(testId: string): Promise<MiniTestAnswer[]>;
  findByTestIds(testIds: string[]): Promise<MiniTestAnswer[]>;
  createMany(answers: Omit<MiniTestAnswer, 'id' | 'createdAt'>[]): Promise<MiniTestAnswer[]>;
}
