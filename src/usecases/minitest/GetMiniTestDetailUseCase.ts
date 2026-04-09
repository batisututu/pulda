import type { UseCase } from '@/shared/types';
import type { MiniTest, VariantQuestion } from '@/domain/entities';
import type { IMiniTestRepository, IVariantRepository } from '@/domain/ports/repositories';
import { NotFoundError } from '@/shared/errors';

export interface GetMiniTestDetailInput {
  testId: string;
}

export interface GetMiniTestDetailOutput {
  test: MiniTest;
  questions: VariantQuestion[];
}

/**
 * GetMiniTestDetailUseCase - 미니테스트와 변형문항을 variantIds 순서대로 로드한다.
 *
 * 풀이 화면(solve screen)에서 테스트 진입 시 사용한다.
 * 소유권 검증은 별도로 하지 않는다(사용자 본인의 네비게이션 흐름에서만 호출).
 */
export class GetMiniTestDetailUseCase
  implements UseCase<GetMiniTestDetailInput, GetMiniTestDetailOutput>
{
  constructor(
    private readonly miniTestRepo: IMiniTestRepository,
    private readonly variantRepo: IVariantRepository,
  ) {}

  async execute(input: GetMiniTestDetailInput): Promise<GetMiniTestDetailOutput> {
    const { testId } = input;

    // 1. 미니테스트 조회
    const test = await this.miniTestRepo.findById(testId);
    if (!test) {
      throw new NotFoundError('MiniTest', testId);
    }

    // 2. variantIds가 비어 있으면 빈 배열 반환
    if (test.variantIds.length === 0) {
      return { test, questions: [] };
    }

    // 3. 변형문항 일괄 조회 후 variantIds 순서 보장
    const variants = await this.variantRepo.findByIds(test.variantIds);
    const variantMap = new Map<string, VariantQuestion>();
    for (const v of variants) {
      variantMap.set(v.id, v);
    }

    const orderedQuestions: VariantQuestion[] = [];
    for (const vid of test.variantIds) {
      const v = variantMap.get(vid);
      if (v) orderedQuestions.push(v);
    }

    return { test, questions: orderedQuestions };
  }
}
