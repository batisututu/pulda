import { GetResultsUseCase } from '@/usecases/minitest/GetResultsUseCase';
import { makeMiniTest, makeMiniTestAnswer, makeVariantQuestion } from '@/__tests__/factories';
import {
  mockMiniTestRepository,
  mockMiniTestAnswerRepository,
  mockVariantRepository,
} from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

describe('GetResultsUseCase', () => {
  const setup = () => {
    const miniTestRepo = mockMiniTestRepository();
    const miniTestAnswerRepo = mockMiniTestAnswerRepository();
    const variantRepo = mockVariantRepository();
    const useCase = new GetResultsUseCase(miniTestRepo, miniTestAnswerRepo, variantRepo);
    return { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo };
  };

  const testData = makeMiniTest({
    id: 'test-1',
    userId: 'u1',
    variantIds: ['v-1', 'v-2'],
    score: 80,
    totalPoints: 100,
    completedAt: new Date().toISOString(),
  });

  it('happy path: test found, answers enriched with variants', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo } = setup();

    miniTestRepo.findById.mockResolvedValue(testData);

    const answer1 = makeMiniTestAnswer({ testId: 'test-1', variantQuestionId: 'v-1' });
    const answer2 = makeMiniTestAnswer({ testId: 'test-1', variantQuestionId: 'v-2' });
    miniTestAnswerRepo.findByTestId.mockResolvedValue([answer1, answer2]);

    const variant1 = makeVariantQuestion({ id: 'v-1', content: 'Q1' });
    const variant2 = makeVariantQuestion({ id: 'v-2', content: 'Q2' });
    variantRepo.findByIds.mockResolvedValue([variant1, variant2]);

    const result = await useCase.execute({ userId: 'u1', testId: 'test-1' });

    expect(result.test.id).toBe('test-1');
    expect(result.answers).toHaveLength(2);
    expect(result.answers[0].variant).toBeDefined();
    expect(result.answers[0].variant!.content).toBe('Q1');
    expect(result.answers[1].variant!.content).toBe('Q2');
  });

  it('throws NotFoundError when test not found', async () => {
    const { useCase, miniTestRepo } = setup();
    miniTestRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'u1', testId: 'missing' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when wrong user', async () => {
    const { useCase, miniTestRepo } = setup();
    miniTestRepo.findById.mockResolvedValue(testData);

    await expect(
      useCase.execute({ userId: 'wrong-user', testId: 'test-1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('handles missing variant (variant=null in enriched answer)', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo } = setup();

    miniTestRepo.findById.mockResolvedValue(testData);

    const answer = makeMiniTestAnswer({ testId: 'test-1', variantQuestionId: 'v-deleted' });
    miniTestAnswerRepo.findByTestId.mockResolvedValue([answer]);

    // No variants returned for the requested IDs
    variantRepo.findByIds.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'u1', testId: 'test-1' });

    expect(result.answers).toHaveLength(1);
    expect(result.answers[0].variant).toBeNull();
  });

  it('returns empty answers when no answers exist', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo } = setup();

    miniTestRepo.findById.mockResolvedValue(testData);
    miniTestAnswerRepo.findByTestId.mockResolvedValue([]);
    variantRepo.findByIds.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'u1', testId: 'test-1' });

    expect(result.answers).toEqual([]);
    expect(result.test.id).toBe('test-1');
  });
});
