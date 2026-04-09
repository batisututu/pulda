import { GetMiniTestDetailUseCase } from '@/usecases/minitest/GetMiniTestDetailUseCase';
import { makeMiniTest, makeVariantQuestion } from '@/__tests__/factories';
import { mockMiniTestRepository, mockVariantRepository } from '@/__tests__/mockBuilders';
import { NotFoundError } from '@/shared/errors';

describe('GetMiniTestDetailUseCase', () => {
  const setup = () => {
    const miniTestRepo = mockMiniTestRepository();
    const variantRepo = mockVariantRepository();
    const useCase = new GetMiniTestDetailUseCase(miniTestRepo, variantRepo);
    return { useCase, miniTestRepo, variantRepo };
  };

  it('should return test and ordered questions', async () => {
    const { useCase, miniTestRepo, variantRepo } = setup();

    const testData = makeMiniTest({
      id: 'test-1',
      variantIds: ['v-3', 'v-1', 'v-2'],
    });
    miniTestRepo.findById.mockResolvedValue(testData);

    // findByIds 결과 순서는 variantIds와 다를 수 있다
    const v1 = makeVariantQuestion({ id: 'v-1', content: 'Q1' });
    const v2 = makeVariantQuestion({ id: 'v-2', content: 'Q2' });
    const v3 = makeVariantQuestion({ id: 'v-3', content: 'Q3' });
    variantRepo.findByIds.mockResolvedValue([v1, v2, v3]);

    const result = await useCase.execute({ testId: 'test-1' });

    expect(result.test.id).toBe('test-1');
    expect(result.questions).toHaveLength(3);
    // variantIds 순서대로 정렬되어야 한다: v-3, v-1, v-2
    expect(result.questions[0].id).toBe('v-3');
    expect(result.questions[1].id).toBe('v-1');
    expect(result.questions[2].id).toBe('v-2');
  });

  it('should throw NotFoundError when test not found', async () => {
    const { useCase, miniTestRepo } = setup();
    miniTestRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ testId: 'missing' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should return empty questions when variantIds is empty', async () => {
    const { useCase, miniTestRepo, variantRepo } = setup();

    const testData = makeMiniTest({ id: 'test-empty', variantIds: [] });
    miniTestRepo.findById.mockResolvedValue(testData);

    const result = await useCase.execute({ testId: 'test-empty' });

    expect(result.test.id).toBe('test-empty');
    expect(result.questions).toEqual([]);
    // variantIds가 비어 있으면 findByIds를 호출하지 않아야 한다
    expect(variantRepo.findByIds).not.toHaveBeenCalled();
  });

  it('should handle missing variants gracefully', async () => {
    const { useCase, miniTestRepo, variantRepo } = setup();

    // 테스트에는 3개의 variantId가 있지만 실제로 존재하는 것은 2개뿐
    const testData = makeMiniTest({
      id: 'test-partial',
      variantIds: ['v-1', 'v-deleted', 'v-2'],
    });
    miniTestRepo.findById.mockResolvedValue(testData);

    const v1 = makeVariantQuestion({ id: 'v-1', content: 'Q1' });
    const v2 = makeVariantQuestion({ id: 'v-2', content: 'Q2' });
    variantRepo.findByIds.mockResolvedValue([v1, v2]);

    const result = await useCase.execute({ testId: 'test-partial' });

    // 삭제된 variant는 건너뛰고 존재하는 것만 순서대로 반환
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].id).toBe('v-1');
    expect(result.questions[1].id).toBe('v-2');
  });
});
