import type { Question, ClassificationResult, ExplanationResult } from '@/domain/entities';
import type { Subject } from '@/domain/value-objects';

export interface IExplanationGateway {
  diagnose(
    question: Question,
    studentAnswer: string,
    classification: ClassificationResult,
    grade?: string,
    subject?: Subject,
  ): Promise<ExplanationResult>;
}
