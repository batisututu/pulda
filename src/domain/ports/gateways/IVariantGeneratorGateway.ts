import type { ErrorDiagnosis, Question, VariantGenerationResult } from '@/domain/entities';
import type { Difficulty } from '@/domain/value-objects/Difficulty';
import type { QuestionType } from '@/domain/value-objects/QuestionType';

export interface IVariantGeneratorGateway {
  generate(
    diagnosis: ErrorDiagnosis,
    originalQuestion: Question,
    count: number
  ): Promise<VariantGenerationResult>;

  generateByTopic(params: {
    topic: string;
    grade: string;
    difficulty: Difficulty;
    questionType: QuestionType;
    count: number;
  }): Promise<VariantGenerationResult>;
}
