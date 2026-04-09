import { SubmitAnswersUseCase } from '@/usecases/minitest/SubmitAnswersUseCase';
import { makeMiniTest, makeVariantQuestion, makeParentLink } from '@/__tests__/factories';
import {
  mockMiniTestRepository,
  mockMiniTestAnswerRepository,
  mockVariantRepository,
  mockNotificationRepository,
  mockParentLinkRepository,
} from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@/shared/errors';

describe('SubmitAnswersUseCase', () => {
  const setup = () => {
    const miniTestRepo = mockMiniTestRepository();
    const miniTestAnswerRepo = mockMiniTestAnswerRepository();
    const variantRepo = mockVariantRepository();
    const notificationRepo = mockNotificationRepository();
    const parentLinkRepo = mockParentLinkRepository();
    const useCase = new SubmitAnswersUseCase(
      miniTestRepo,
      miniTestAnswerRepo,
      variantRepo,
      notificationRepo,
      parentLinkRepo,
    );
    return { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, notificationRepo, parentLinkRepo };
  };

  it('happy path: scores and returns results', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1', 'v2'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'multiple_choice', answer: '2' });
    const v2 = makeVariantQuestion({ id: 'v2', questionType: 'short_answer', answer: '3x' });
    variantRepo.findByIds.mockResolvedValue([v1, v2]);

    miniTestAnswerRepo.createMany.mockImplementation(async (answers) =>
      answers.map((a: Record<string, unknown>, i: number) => ({
        ...a,
        id: `a${i}`,
        createdAt: new Date().toISOString(),
      })),
    );

    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [
        { variantQuestionId: 'v1', userAnswer: '2', timeSpent: 10 },
        { variantQuestionId: 'v2', userAnswer: ' 3x ', timeSpent: 15 },
      ],
      totalTimeSpent: 25,
    });

    expect(result.score).toBe(2);
    expect(result.totalPoints).toBe(2);
    expect(miniTestAnswerRepo.createMany).toHaveBeenCalledOnce();
    expect(miniTestRepo.update).toHaveBeenCalledOnce();
  });

  it('throws NotFoundError when test not found', async () => {
    const { useCase, miniTestRepo } = setup();
    miniTestRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'u1',
        testId: 'nonexistent',
        answers: [],
        totalTimeSpent: 0,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user is not owner', async () => {
    const { useCase, miniTestRepo } = setup();
    const test = makeMiniTest({ userId: 'owner-id', completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    await expect(
      useCase.execute({
        userId: 'different-user',
        testId: test.id,
        answers: [],
        totalTimeSpent: 0,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ConflictError when already completed', async () => {
    const { useCase, miniTestRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', completedAt: new Date().toISOString() });
    miniTestRepo.findById.mockResolvedValue(test);

    await expect(
      useCase.execute({
        userId: 'u1',
        testId: test.id,
        answers: [],
        totalTimeSpent: 0,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws ValidationError for invalid variant ID', async () => {
    const { useCase, miniTestRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    await expect(
      useCase.execute({
        userId: 'u1',
        testId: test.id,
        answers: [{ variantQuestionId: 'not-in-test', userAnswer: '1', timeSpent: 5 }],
        totalTimeSpent: 5,
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('MC scoring: correct index scores as correct', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'multiple_choice', answer: '3' });
    variantRepo.findByIds.mockResolvedValue([v1]);
    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [{ variantQuestionId: 'v1', userAnswer: '3', timeSpent: 10 }],
      totalTimeSpent: 10,
    });

    expect(result.score).toBe(1);
    expect(result.totalPoints).toBe(1);
  });

  it('MC scoring: wrong index scores as incorrect', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'multiple_choice', answer: '3' });
    variantRepo.findByIds.mockResolvedValue([v1]);
    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [{ variantQuestionId: 'v1', userAnswer: '1', timeSpent: 10 }],
      totalTimeSpent: 10,
    });

    expect(result.score).toBe(0);
    expect(result.totalPoints).toBe(1);
  });

  it('short answer scoring with normalization', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'short_answer', answer: '2x + 1' });
    variantRepo.findByIds.mockResolvedValue([v1]);
    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    // Whitespace differs but normalizes to same value
    const result = await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [{ variantQuestionId: 'v1', userAnswer: ' 2x+1 ', timeSpent: 10 }],
      totalTimeSpent: 10,
    });

    expect(result.score).toBe(1);
    expect(result.totalPoints).toBe(1);
  });

  it('notifies parent when active link exists', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, notificationRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'multiple_choice', answer: '1' });
    variantRepo.findByIds.mockResolvedValue([v1]);
    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));

    parentLinkRepo.findByChild.mockResolvedValue([
      makeParentLink({ status: 'active', parentUserId: 'p1', childUserId: 'u1' }),
    ]);

    await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [{ variantQuestionId: 'v1', userAnswer: '1', timeSpent: 5 }],
      totalTimeSpent: 5,
    });

    // Wait for fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'p1',
        type: 'mini_test_completed',
      }),
    );
  });

  it('parent notification failure does not throw', async () => {
    const { useCase, miniTestRepo, miniTestAnswerRepo, variantRepo, parentLinkRepo } = setup();
    const test = makeMiniTest({ userId: 'u1', variantIds: ['v1'], completedAt: null });
    miniTestRepo.findById.mockResolvedValue(test);

    const v1 = makeVariantQuestion({ id: 'v1', questionType: 'multiple_choice', answer: '1' });
    variantRepo.findByIds.mockResolvedValue([v1]);
    miniTestRepo.update.mockImplementation(async (id, data) => ({ ...test, ...data, id }));

    parentLinkRepo.findByChild.mockRejectedValue(new Error('DB connection failed'));

    const result = await useCase.execute({
      userId: 'u1',
      testId: test.id,
      answers: [{ variantQuestionId: 'v1', userAnswer: '1', timeSpent: 5 }],
      totalTimeSpent: 5,
    });

    // Should still return successfully
    expect(result.score).toBeDefined();
    expect(result.totalPoints).toBeDefined();
  });
});
