import type { Exam } from '@/domain/entities';

export interface IExamRepository {
  findById(id: string): Promise<Exam | null>;
  findByUserId(userId: string): Promise<Exam[]>;
  create(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam>;
  update(id: string, data: Partial<Exam>): Promise<Exam>;
  delete(id: string): Promise<void>;
}
