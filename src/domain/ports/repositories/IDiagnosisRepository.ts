import type { ErrorDiagnosis } from '@/domain/entities';

export interface IDiagnosisRepository {
  findById(id: string): Promise<ErrorDiagnosis | null>;
  findByQuestionId(questionId: string): Promise<ErrorDiagnosis | null>;
  findByExamId(examId: string): Promise<ErrorDiagnosis[]>;
  findByExamIds(examIds: string[]): Promise<ErrorDiagnosis[]>;
  create(diagnosis: Omit<ErrorDiagnosis, 'id' | 'createdAt'>): Promise<ErrorDiagnosis>;
  createMany(diagnoses: Omit<ErrorDiagnosis, 'id' | 'createdAt'>[]): Promise<ErrorDiagnosis[]>;
}
