import type { UseCase } from '@/shared/types';
import type { MiniTest } from '@/domain/entities';
import type { IMiniTestRepository } from '@/domain/ports/repositories';
import type { IVariantRepository } from '@/domain/ports/repositories';
import { ValidationError } from '@/shared/errors';

export interface CreateMiniTestInput {
  userId: string;
  variantIds: string[];
}

export interface CreateMiniTestOutput {
  test: MiniTest;
}

/**
 * CreateMiniTestUseCase - Creates a new mini test from selected variant questions.
 *
 * Validates that variant IDs are non-empty, unique, within limit, and all exist.
 */
export class CreateMiniTestUseCase implements UseCase<CreateMiniTestInput, CreateMiniTestOutput> {
  constructor(
    private readonly miniTestRepo: IMiniTestRepository,
    private readonly variantRepo: IVariantRepository,
  ) {}

  async execute(input: CreateMiniTestInput): Promise<CreateMiniTestOutput> {
    const { userId, variantIds } = input;

    // Validate non-empty
    if (!variantIds || variantIds.length === 0) {
      throw new ValidationError('변형문항을 하나 이상 선택해야 합니다.');
    }

    // Validate max 20
    if (variantIds.length > 20) {
      throw new ValidationError('변형문항은 최대 20개까지 선택할 수 있습니다.');
    }

    // Validate no duplicates
    const uniqueIds = new Set(variantIds);
    if (uniqueIds.size !== variantIds.length) {
      throw new ValidationError('중복된 변형문항이 포함되어 있습니다.');
    }

    // Validate all variants exist
    const variants = await this.variantRepo.findByIds(variantIds);
    if (variants.length !== variantIds.length) {
      throw new ValidationError('존재하지 않는 변형문항이 포함되어 있습니다.');
    }

    // Create mini test
    const test = await this.miniTestRepo.create({
      userId,
      variantIds,
      score: null,
      totalPoints: null,
      timeSpent: null,
      completedAt: null,
    });

    return { test };
  }
}
