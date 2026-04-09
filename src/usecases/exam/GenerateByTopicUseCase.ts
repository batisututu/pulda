import type { UseCase } from '@/shared/types';
import type { VariantQuestion } from '@/domain/entities';
import type { IVariantRepository } from '@/domain/ports/repositories';
import type { IVariantGeneratorGateway } from '@/domain/ports/gateways';
import type { Difficulty } from '@/domain/value-objects/Difficulty';
import type { QuestionType } from '@/domain/value-objects/QuestionType';
import { ValidationError } from '@/shared/errors';

export interface GenerateByTopicInput {
  userId: string;
  topic: string;
  grade: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  count: number;
}

export interface GenerateByTopicOutput {
  variants: VariantQuestion[];
  creditsUsed: number;
}

/**
 * Generates math questions independently by topic, grade, and difficulty.
 * No exam or diagnosis required — uses AI to create fresh problems.
 */
export class GenerateByTopicUseCase implements UseCase<GenerateByTopicInput, GenerateByTopicOutput> {
  constructor(
    private readonly variantRepo: IVariantRepository,
    private readonly variantGeneratorGateway: IVariantGeneratorGateway,
  ) {}

  async execute(input: GenerateByTopicInput): Promise<GenerateByTopicOutput> {
    const { userId, topic, grade, difficulty, questionType, count } = input;

    // 1. Validate
    if (!topic || topic.trim().length === 0) {
      throw new ValidationError('주제를 입력해주세요.');
    }
    if (count < 1 || count > 5) {
      throw new ValidationError('문제 수는 1~5개로 선택해주세요.');
    }

    // 2. Generate via AI
    const result = await this.variantGeneratorGateway.generateByTopic({
      topic: topic.trim(),
      grade,
      difficulty,
      questionType,
      count,
    });

    // 4. Persist with userId, topic, grade (no diagnosisId)
    const variants = await this.variantRepo.createMany(
      result.variants.map((v) => ({
        diagnosisId: null,
        userId,
        topic: topic.trim(),
        grade,
        content: v.content,
        questionType: v.type,
        options: v.options,
        answer: v.answer,
        explanation: v.explanation,
        difficulty: v.difficulty,
        targetErrorType: v.targetErrorType,
        bloomLevel: v.bloomLevel,
        trapPoint: v.trapPoint,
        targetTimeSeconds: v.targetTimeSeconds,
        verification: v.verification ?? null,
        visualExplanation: v.visualExplanation ?? null,
      })),
    );

    return { variants, creditsUsed: 0 };
  }
}
