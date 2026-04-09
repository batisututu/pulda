import type { UseCase } from '@/shared/types';
import type { MiniTest, MiniTestAnswer, VariantQuestion } from '@/domain/entities';
import type {
  IMiniTestRepository,
  IMiniTestAnswerRepository,
  IVariantRepository,
} from '@/domain/ports/repositories';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

export interface GetResultsInput {
  userId: string;
  testId: string;
}

export interface EnrichedAnswer extends MiniTestAnswer {
  variant: VariantQuestion | null;
}

export interface GetResultsOutput {
  test: MiniTest;
  answers: EnrichedAnswer[];
}

/**
 * GetResultsUseCase - Retrieves mini test results with enriched answer data.
 *
 * Loads the test, verifies ownership, then enriches each answer with
 * its associated variant question data.
 */
export class GetResultsUseCase implements UseCase<GetResultsInput, GetResultsOutput> {
  constructor(
    private readonly miniTestRepo: IMiniTestRepository,
    private readonly miniTestAnswerRepo: IMiniTestAnswerRepository,
    private readonly variantRepo: IVariantRepository,
  ) {}

  async execute(input: GetResultsInput): Promise<GetResultsOutput> {
    const { userId, testId } = input;

    // 1. Load test and verify ownership
    const test = await this.miniTestRepo.findById(testId);
    if (!test) {
      throw new NotFoundError('MiniTest', testId);
    }
    if (test.userId !== userId) {
      throw new ForbiddenError('Access denied: not the test owner');
    }

    // 2. Load answers
    const answers = await this.miniTestAnswerRepo.findByTestId(testId);

    // 3. Load variants for enrichment
    const variants = await this.variantRepo.findByIds(test.variantIds);
    const variantMap = new Map<string, VariantQuestion>();
    for (const v of variants) {
      variantMap.set(v.id, v);
    }

    // 4. Enrich answers with variant data
    const enrichedAnswers: EnrichedAnswer[] = answers.map((answer) => ({
      ...answer,
      variant: variantMap.get(answer.variantQuestionId) ?? null,
    }));

    return {
      test,
      answers: enrichedAnswers,
    };
  }
}
