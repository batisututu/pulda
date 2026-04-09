/**
 * E2-3. Mini Test Integration Test
 *
 * Scenarios:
 * 1. Create test -> submit answers -> verify scoring results
 * 2. Get results for non-existent test -> NotFoundError
 */
import type {
  IMiniTestRepository,
  IMiniTestAnswerRepository,
  IVariantRepository,
  INotificationRepository,
  IParentLinkRepository,
} from '@/domain/ports/repositories';
import { NotFoundError } from '@/shared/errors';
import {
  makeMiniTest,
  makeVariantQuestion,
} from '@/__tests__/factories';
import {
  mockMiniTestRepository,
  mockMiniTestAnswerRepository,
  mockVariantRepository,
  mockNotificationRepository,
  mockParentLinkRepository,
} from '@/__tests__/mockBuilders';
import { CreateMiniTestUseCase } from '@/usecases/minitest/CreateMiniTestUseCase';
import { SubmitAnswersUseCase } from '@/usecases/minitest/SubmitAnswersUseCase';
import { GetResultsUseCase } from '@/usecases/minitest/GetResultsUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('Mini Test Flow (Integration)', () => {
  const userId = 'user-mini-001';

  let miniTestRepo: Mocked<IMiniTestRepository>;
  let miniTestAnswerRepo: Mocked<IMiniTestAnswerRepository>;
  let variantRepo: Mocked<IVariantRepository>;
  let notificationRepo: Mocked<INotificationRepository>;
  let parentLinkRepo: Mocked<IParentLinkRepository>;

  let createUseCase: CreateMiniTestUseCase;
  let submitUseCase: SubmitAnswersUseCase;
  let getResultsUseCase: GetResultsUseCase;

  // Shared variant questions
  const variant1 = makeVariantQuestion({
    id: 'var-1',
    content: '$x + 1 = 3$',
    questionType: 'short_answer',
    answer: '2',
    difficulty: 'easy',
  });
  const variant2 = makeVariantQuestion({
    id: 'var-2',
    content: '$2x = 10$',
    questionType: 'short_answer',
    answer: '5',
    difficulty: 'medium',
  });
  const variant3 = makeVariantQuestion({
    id: 'var-3',
    content: '$x^2 = 9$',
    questionType: 'short_answer',
    answer: '3',
    difficulty: 'hard',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    miniTestRepo = mockMiniTestRepository();
    miniTestAnswerRepo = mockMiniTestAnswerRepository();
    variantRepo = mockVariantRepository();
    notificationRepo = mockNotificationRepository();
    parentLinkRepo = mockParentLinkRepository();

    createUseCase = new CreateMiniTestUseCase(miniTestRepo, variantRepo);
    submitUseCase = new SubmitAnswersUseCase(
      miniTestRepo,
      miniTestAnswerRepo,
      variantRepo,
      notificationRepo,
      parentLinkRepo,
    );
    getResultsUseCase = new GetResultsUseCase(
      miniTestRepo,
      miniTestAnswerRepo,
      variantRepo,
    );

    // Variants exist in repo
    variantRepo.findByIds.mockResolvedValue([variant1, variant2, variant3]);

    // No parent links by default
    parentLinkRepo.findByChild.mockResolvedValue([]);
  });

  describe('Success: create test -> submit answers -> get scored results', () => {
    it('completes the full mini test lifecycle', async () => {
      // === Step 1: Create mini test ===
      const createResult = await createUseCase.execute({
        userId,
        variantIds: ['var-1', 'var-2', 'var-3'],
      });

      expect(createResult.test).toBeDefined();
      expect(createResult.test.userId).toBe(userId);
      expect(createResult.test.variantIds).toEqual(['var-1', 'var-2', 'var-3']);
      expect(createResult.test.score).toBeNull();
      expect(createResult.test.completedAt).toBeNull();

      const testId = createResult.test.id;

      // === Step 2: Submit answers ===
      // Mock: the created test can be found
      miniTestRepo.findById.mockResolvedValue(
        makeMiniTest({
          id: testId,
          userId,
          variantIds: ['var-1', 'var-2', 'var-3'],
          completedAt: null,
        }),
      );

      const submitResult = await submitUseCase.execute({
        userId,
        testId,
        answers: [
          { variantQuestionId: 'var-1', userAnswer: '2', timeSpent: 30 },   // correct
          { variantQuestionId: 'var-2', userAnswer: '4', timeSpent: 45 },   // wrong
          { variantQuestionId: 'var-3', userAnswer: '3', timeSpent: 60 },   // correct
        ],
        totalTimeSpent: 135,
      });

      // Score: 2 correct out of 3
      expect(submitResult.score).toBe(2);
      expect(submitResult.totalPoints).toBe(3);
      expect(submitResult.answers).toHaveLength(3);

      // Verify individual answers scored correctly
      const answer1 = submitResult.answers.find(a => a.variantQuestionId === 'var-1');
      const answer2 = submitResult.answers.find(a => a.variantQuestionId === 'var-2');
      const answer3 = submitResult.answers.find(a => a.variantQuestionId === 'var-3');
      expect(answer1?.isCorrect).toBe(true);
      expect(answer2?.isCorrect).toBe(false);
      expect(answer3?.isCorrect).toBe(true);

      // Test was updated with results
      expect(miniTestRepo.update).toHaveBeenCalledWith(
        testId,
        expect.objectContaining({
          score: 2,
          totalPoints: 3,
          timeSpent: 135,
        }),
      );

      // === Step 3: Get results ===
      // Mock: updated test with score
      miniTestRepo.findById.mockResolvedValue(
        makeMiniTest({
          id: testId,
          userId,
          variantIds: ['var-1', 'var-2', 'var-3'],
          score: 2,
          totalPoints: 3,
          timeSpent: 135,
          completedAt: new Date().toISOString(),
        }),
      );

      // Mock: saved answers
      miniTestAnswerRepo.findByTestId.mockResolvedValue(submitResult.answers);

      const results = await getResultsUseCase.execute({ userId, testId });

      expect(results.test.score).toBe(2);
      expect(results.test.totalPoints).toBe(3);
      expect(results.answers).toHaveLength(3);

      // Answers are enriched with variant data
      for (const a of results.answers) {
        expect(a.variant).toBeDefined();
      }
    });
  });

  describe('Failure: non-existent test', () => {
    it('throws NotFoundError when test does not exist', async () => {
      miniTestRepo.findById.mockResolvedValue(null);

      await expect(
        getResultsUseCase.execute({
          userId,
          testId: 'non-existent-test-id',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError on submit to non-existent test', async () => {
      miniTestRepo.findById.mockResolvedValue(null);

      await expect(
        submitUseCase.execute({
          userId,
          testId: 'non-existent-test-id',
          answers: [{ variantQuestionId: 'var-1', userAnswer: '2', timeSpent: 30 }],
          totalTimeSpent: 30,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
