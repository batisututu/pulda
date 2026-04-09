import type { SupabaseClient } from '@supabase/supabase-js';
import type { IExamRepository } from '@/domain/ports/repositories/IExamRepository';
import type { Exam } from '@/domain/entities';
import { toDomain, toPersistence, type ExamRow } from '@/infrastructure/mappers/ExamMapper';
import { repoError } from './_shared/repoError';

export class SupabaseExamRepository implements IExamRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Exam | null> {
    const { data, error } = await this.db
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as ExamRow);
  }

  async findByUserId(userId: string): Promise<Exam[]> {
    const { data, error } = await this.db
      .from('exams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseExamRepository', 'findByUserId', error, { userId });
    return (data as ExamRow[]).map(toDomain);
  }

  async create(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> {
    const row = toPersistence(exam);

    // RLS가 INSERT 후 SELECT를 차단할 수 있어 maybeSingle 사용
    const { data, error } = await this.db
      .from('exams')
      .insert(row)
      .select('*')
      .maybeSingle();

    if (error) throw repoError('SupabaseExamRepository', 'create', error, { userId: exam.userId });
    if (!data) {
      // RLS로 인해 반환이 안 된 경우 — 직접 조회
      const { data: fetched, error: fetchError } = await this.db
        .from('exams')
        .select('*')
        .eq('user_id', exam.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !fetched) {
        throw repoError(
          'SupabaseExamRepository',
          'create',
          fetchError ?? { message: '시험 레코드 생성 후 조회에 실패했습니다.' },
          { userId: exam.userId },
        );
      }
      return toDomain(fetched as ExamRow);
    }
    return toDomain(data as ExamRow);
  }

  async update(id: string, data: Partial<Exam>): Promise<Exam> {
    const row = toPersistence(data);

    const { data: updated, error } = await this.db
      .from('exams')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseExamRepository', 'update', error, { id });
    return toDomain(updated as ExamRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from('exams')
      .delete()
      .eq('id', id);

    if (error) throw repoError('SupabaseExamRepository', 'delete', error, { id });
  }
}
