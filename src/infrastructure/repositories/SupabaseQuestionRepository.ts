import type { SupabaseClient } from '@supabase/supabase-js';
import type { IQuestionRepository } from '@/domain/ports/repositories/IQuestionRepository';
import type { Question } from '@/domain/entities';
import { toDomain, toPersistence, type QuestionRow } from '@/infrastructure/mappers/QuestionMapper';
import { repoError } from './_shared/repoError';

export class SupabaseQuestionRepository implements IQuestionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByExamId(examId: string): Promise<Question[]> {
    const { data, error } = await this.db
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .order('number', { ascending: true });

    if (error) throw repoError('SupabaseQuestionRepository', 'findByExamId', error, { examId });
    return (data as QuestionRow[]).map(toDomain);
  }

  async findById(id: string): Promise<Question | null> {
    const { data, error } = await this.db
      .from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as QuestionRow);
  }

  async create(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question> {
    const row = toPersistence(question);

    const { data, error } = await this.db
      .from('questions')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw repoError('SupabaseQuestionRepository', 'create', error, { examId: question.examId });
    }
    return toDomain(data as QuestionRow);
  }

  async createMany(questions: Omit<Question, 'id' | 'createdAt'>[]): Promise<Question[]> {
    const rows = questions.map(toPersistence);

    const { data, error } = await this.db
      .from('questions')
      .insert(rows)
      .select('*');

    if (error) {
      throw repoError('SupabaseQuestionRepository', 'createMany', error, { count: questions.length });
    }
    return (data as QuestionRow[]).map(toDomain);
  }

  async updateMany(questions: { id: string; data: Partial<Question> }[]): Promise<void> {
    // Supabase JS 클라이언트는 단일 호출로 배치 업데이트를 지원하지 않으므로 병렬 실행
    const results = await Promise.all(
      questions.map(({ id, data }) => {
        const row = toPersistence(data);
        return this.db
          .from('questions')
          .update(row)
          .eq('id', id);
      }),
    );

    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      throw repoError('SupabaseQuestionRepository', 'updateMany', firstError.error, { count: questions.length });
    }
  }

  async deleteByExamId(examId: string): Promise<void> {
    const { error } = await this.db
      .from('questions')
      .delete()
      .eq('exam_id', examId);

    if (error) throw repoError('SupabaseQuestionRepository', 'deleteByExamId', error, { examId });
  }
}
