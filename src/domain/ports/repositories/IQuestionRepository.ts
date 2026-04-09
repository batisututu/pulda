import type { Question } from '@/domain/entities';

export interface IQuestionRepository {
  findByExamId(examId: string): Promise<Question[]>;
  findById(id: string): Promise<Question | null>;
  create(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question>;
  createMany(questions: Omit<Question, 'id' | 'createdAt'>[]): Promise<Question[]>;
  updateMany(questions: { id: string; data: Partial<Question> }[]): Promise<void>;
  deleteByExamId(examId: string): Promise<void>;
}
