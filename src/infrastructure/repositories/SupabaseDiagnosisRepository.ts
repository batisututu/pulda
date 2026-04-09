import type { SupabaseClient } from '@supabase/supabase-js';
import type { IDiagnosisRepository } from '@/domain/ports/repositories/IDiagnosisRepository';
import type { ErrorDiagnosis } from '@/domain/entities';
import {
  toDomain,
  toPersistence,
  type DiagnosisRow,
} from '@/infrastructure/mappers/DiagnosisMapper';
import { repoError } from './_shared/repoError';

export class SupabaseDiagnosisRepository implements IDiagnosisRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<ErrorDiagnosis | null> {
    const { data, error } = await this.db
      .from('error_diagnoses')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as DiagnosisRow);
  }

  async findByQuestionId(questionId: string): Promise<ErrorDiagnosis | null> {
    const { data, error } = await this.db
      .from('error_diagnoses')
      .select('*')
      .eq('question_id', questionId)
      .single();

    if (error || !data) return null;
    return toDomain(data as DiagnosisRow);
  }

  async findByExamId(examId: string): Promise<ErrorDiagnosis[]> {
    // error_diagnoses는 question_id를 가짐; exam_id는 questions 테이블에 있으므로 inner join 사용
    const { data, error } = await this.db
      .from('error_diagnoses')
      .select('*, questions!inner(exam_id)')
      .eq('questions.exam_id', examId);

    if (error) throw repoError('SupabaseDiagnosisRepository', 'findByExamId', error, { examId });
    if (!data) return [];

    return data.map((row) => toDomain(row as unknown as DiagnosisRow));
  }

  async findByExamIds(examIds: string[]): Promise<ErrorDiagnosis[]> {
    if (examIds.length === 0) return [];

    const { data, error } = await this.db
      .from('error_diagnoses')
      .select('*, questions!inner(exam_id)')
      .in('questions.exam_id', examIds);

    if (error) throw repoError('SupabaseDiagnosisRepository', 'findByExamIds', error, { examIds });
    if (!data) return [];
    return data.map((row) => toDomain(row as unknown as DiagnosisRow));
  }

  async create(
    diagnosis: Omit<ErrorDiagnosis, 'id' | 'createdAt'>,
  ): Promise<ErrorDiagnosis> {
    const row = toPersistence(diagnosis);

    const { data, error } = await this.db
      .from('error_diagnoses')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw repoError(
        'SupabaseDiagnosisRepository',
        'create',
        error ?? { message: 'Failed to create diagnosis' },
        { questionId: diagnosis.questionId },
      );
    }
    return toDomain(data as DiagnosisRow);
  }

  async createMany(
    diagnoses: Omit<ErrorDiagnosis, 'id' | 'createdAt'>[],
  ): Promise<ErrorDiagnosis[]> {
    if (diagnoses.length === 0) return [];

    const rows = diagnoses.map((d) => toPersistence(d));

    const { data, error } = await this.db
      .from('error_diagnoses')
      .insert(rows)
      .select('*');

    if (error || !data) {
      throw repoError(
        'SupabaseDiagnosisRepository',
        'createMany',
        error ?? { message: 'Failed to create diagnoses' },
        { count: diagnoses.length },
      );
    }
    return data.map((row) => toDomain(row as unknown as DiagnosisRow));
  }
}
