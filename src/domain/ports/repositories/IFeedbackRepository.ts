import type { Feedback } from '@/domain/entities';

export interface IFeedbackRepository {
  findByTarget(targetType: string, targetId: string, userId: string): Promise<Feedback | null>;
  upsert(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback>;
}
