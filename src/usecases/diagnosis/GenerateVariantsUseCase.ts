import type { UseCase } from '@/shared/types';
import type { VariantQuestion } from '@/domain/entities';
import type {
  IDiagnosisRepository,
  IQuestionRepository,
  IExamRepository,
  IVariantRepository,
  ICreditRepository,
} from '@/domain/ports/repositories';
import type { IVariantGeneratorGateway } from '@/domain/ports/gateways';
import { hasSufficientCredits, getRemainingCredits } from '@/domain/rules/creditRules';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  InsufficientCreditsError,
} from '@/shared/errors';

export interface GenerateVariantsInput {
  userId: string;
  diagnosisId: string;
  count: number;
}

export interface GenerateVariantsOutput {
  diagnosisId: string;
  variants: VariantQuestion[];
  creditsUsed: number;
}

/**
 * GenerateVariantsUseCase - Generates additional variant questions for a diagnosis.
 *
 * Allows users to request more practice variants (1-5) for a specific
 * error diagnosis. Costs 1 credit per generation call.
 */
export class GenerateVariantsUseCase implements UseCase<GenerateVariantsInput, GenerateVariantsOutput> {
  constructor(
    private readonly diagnosisRepo: IDiagnosisRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly examRepo: IExamRepository,
    private readonly variantRepo: IVariantRepository,
    private readonly creditRepo: ICreditRepository,
    private readonly variantGeneratorGateway: IVariantGeneratorGateway,
  ) {}

  async execute(input: GenerateVariantsInput): Promise<GenerateVariantsOutput> {
    const { userId, diagnosisId, count } = input;

    // 1. Validate count
    if (count < 1 || count > 5) {
      throw new ValidationError('Variant count must be between 1 and 5');
    }

    // 2. Load diagnosis and verify ownership through question -> exam chain
    const diagnosis = await this.diagnosisRepo.findById(diagnosisId);
    if (!diagnosis) {
      throw new NotFoundError('Diagnosis', diagnosisId);
    }

    const question = await this.questionRepo.findById(diagnosis.questionId);
    if (!question) {
      throw new NotFoundError('Question', diagnosis.questionId);
    }

    const exam = await this.examRepo.findById(question.examId);
    if (!exam) {
      throw new NotFoundError('Exam', question.examId);
    }

    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    // 3. Generate variants via AI gateway
    const result = await this.variantGeneratorGateway.generate(diagnosis, question, count);

    // 5. Persist variants
    const variants = await this.variantRepo.createMany(
      result.variants.map((v) => ({
        diagnosisId: diagnosis.id,
        userId: null,
        topic: null,
        grade: null,
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

    return {
      diagnosisId: diagnosis.id,
      variants,
      creditsUsed: 0,
    };
  }
}
