/**
 * E2-2. Analyze Exam Pipeline Integration Test
 *
 * Scenarios:
 * 1. Success: 2 wrong questions -> L2 classify -> L3 diagnose -> L4 variants -> credit deduction -> status analyzed
 * 2. Failure: ownership mismatch -> ForbiddenError
 * 3. Failure: insufficient credits -> InsufficientCreditsError
 */
import type {
  IExamRepository,
  IQuestionRepository,
  IBlueprintRepository,
  IDiagnosisRepository,
  IVariantRepository,
  ICreditRepository,
  ICacheRepository,
  IUserRepository,
} from '@/domain/ports/repositories';
import type {
  IClassifierGateway,
  IExplanationGateway,
  IVerifierGateway,
  IVariantGeneratorGateway,
} from '@/domain/ports/gateways';
import { ForbiddenError, InsufficientCreditsError } from '@/shared/errors';
import {
  makeExam,
  makeQuestion,
  makeCredit,
  makeUser,
} from '@/__tests__/factories';
import {
  mockExamRepository,
  mockQuestionRepository,
  mockBlueprintRepository,
  mockDiagnosisRepository,
  mockVariantRepository,
  mockCreditRepository,
  mockUserRepository,
} from '@/__tests__/mockBuilders';
import {
  mockClassifierGateway,
  mockExplanationGateway,
  mockVerifierGateway,
  mockVariantGeneratorGateway,
} from '@/__tests__/mockGateways';
import { AnalyzeExamUseCase } from '@/usecases/diagnosis/AnalyzeExamUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

function mockCacheRepository(): Mocked<ICacheRepository> {
  return {
    findByHash: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation((hash, data) => Promise.resolve({
      id: crypto.randomUUID(),
      contentHash: hash,
      classification: data.classification ?? null,
      explanation: data.explanation ?? null,
      hitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    incrementHitCount: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Analyze Exam Flow (Integration)', () => {
  const userId = 'user-analyze-001';
  const examId = 'exam-analyze-001';

  let examRepo: Mocked<IExamRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let blueprintRepo: Mocked<IBlueprintRepository>;
  let diagnosisRepo: Mocked<IDiagnosisRepository>;
  let variantRepo: Mocked<IVariantRepository>;
  let creditRepo: Mocked<ICreditRepository>;
  let cacheRepo: Mocked<ICacheRepository>;
  let userRepo: Mocked<IUserRepository>;
  let classifierGw: Mocked<IClassifierGateway>;
  let explanationGw: Mocked<IExplanationGateway>;
  let verifierGw: Mocked<IVerifierGateway>;
  let variantGenGw: Mocked<IVariantGeneratorGateway>;
  let useCase: AnalyzeExamUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    examRepo = mockExamRepository();
    questionRepo = mockQuestionRepository();
    blueprintRepo = mockBlueprintRepository();
    diagnosisRepo = mockDiagnosisRepository();
    variantRepo = mockVariantRepository();
    creditRepo = mockCreditRepository();
    cacheRepo = mockCacheRepository();
    userRepo = mockUserRepository();
    classifierGw = mockClassifierGateway();
    explanationGw = mockExplanationGateway();
    verifierGw = mockVerifierGateway();
    variantGenGw = mockVariantGeneratorGateway();

    useCase = new AnalyzeExamUseCase(
      examRepo,
      questionRepo,
      blueprintRepo,
      diagnosisRepo,
      variantRepo,
      creditRepo,
      cacheRepo,
      userRepo,
      classifierGw,
      explanationGw,
      verifierGw,
      variantGenGw,
    );

    // Default: user exists
    userRepo.findById.mockResolvedValue(makeUser({ id: userId }));
  });

  describe('Success: full analysis pipeline with 2 wrong questions', () => {
    const correctQ = makeQuestion({
      id: 'q-correct-1',
      examId,
      number: 1,
      isCorrect: true,
      content: '$2 + 2 = ?$',
      answer: '4',
      studentAnswer: '4',
    });

    const wrongQ1 = makeQuestion({
      id: 'q-wrong-1',
      examId,
      number: 2,
      isCorrect: false,
      content: '$x^2 + 2x + 1 = 0$을 풀어라.',
      answer: '-1',
      studentAnswer: '1',
    });

    const wrongQ2 = makeQuestion({
      id: 'q-wrong-2',
      examId,
      number: 3,
      isCorrect: false,
      content: '$3x - 6 = 0$을 풀어라.',
      answer: '2',
      studentAnswer: '3',
    });

    beforeEach(() => {
      // Exam in 'verified' status (ready for analysis)
      examRepo.findById.mockResolvedValue(
        makeExam({
          id: examId,
          userId,
          status: 'verified',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );

      // 3 questions: 1 correct, 2 wrong
      questionRepo.findByExamId.mockResolvedValue([correctQ, wrongQ1, wrongQ2]);

      // Sufficient credits
      creditRepo.findByUserId.mockResolvedValue(
        makeCredit({ userId, total: 30, used: 0 }),
      );
    });

    it('completes L2 -> L3 -> L4 pipeline, deducts credits, and sets status to analyzed', async () => {
      const result = await useCase.execute({ userId, examId });

      // -- Output structure --
      expect(result.examId).toBe(examId);
      expect(result.status).toBe('analyzed');

      // -- Summary --
      expect(result.summary.totalQuestions).toBe(3);
      expect(result.summary.correctCount).toBe(1);
      expect(result.summary.wrongCount).toBe(2);
      expect(result.summary.accuracy).toBeCloseTo(1 / 3);

      // -- L2: Classification was called for all questions (no cache) --
      expect(classifierGw.classifyBatch).toHaveBeenCalled();
      expect(classifierGw.generateBlueprint).toHaveBeenCalled();
      expect(result.blueprint).toBeDefined();

      // -- L3: Explanation called for each wrong question --
      expect(explanationGw.diagnose).toHaveBeenCalledTimes(2);
      expect(verifierGw.verify).toHaveBeenCalledTimes(2);
      expect(result.diagnoses).toHaveLength(2);

      // -- L4: Variant generation called for each diagnosis --
      expect(variantGenGw.generate).toHaveBeenCalledTimes(2);
      expect(result.variants.length).toBeGreaterThan(0);

      // -- Credit deduction (2 wrong questions, 0 cache hits) --
      expect(result.creditsUsed).toBe(2);
      expect(creditRepo.deduct).toHaveBeenCalledWith(userId, 2);

      // -- Status updated to 'analyzed' --
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'analyzed' });
    });

    it('enriches diagnoses with question and variants data', async () => {
      const result = await useCase.execute({ userId, examId });

      for (const d of result.diagnoses) {
        // Each diagnosis has its question attached
        expect(d.question).toBeDefined();
        expect(d.question.id).toBeDefined();
        // Each diagnosis has its variants array
        expect(Array.isArray(d.variants)).toBe(true);
      }
    });
  });

  describe('Failure: ownership mismatch', () => {
    it('throws ForbiddenError when userId does not match exam owner', async () => {
      examRepo.findById.mockResolvedValue(
        makeExam({
          id: examId,
          userId: 'other-user-999',
          status: 'verified',
        }),
      );

      await expect(useCase.execute({ userId, examId }))
        .rejects.toThrow(ForbiddenError);

      // Pipeline should not proceed
      expect(questionRepo.findByExamId).not.toHaveBeenCalled();
      expect(classifierGw.classifyBatch).not.toHaveBeenCalled();
      expect(creditRepo.deduct).not.toHaveBeenCalled();
    });
  });

  describe('Failure: insufficient credits', () => {
    it('throws InsufficientCreditsError when not enough credits for wrong questions', async () => {
      examRepo.findById.mockResolvedValue(
        makeExam({
          id: examId,
          userId,
          status: 'verified',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      );

      // 3 wrong questions
      questionRepo.findByExamId.mockResolvedValue([
        makeQuestion({ examId, isCorrect: false }),
        makeQuestion({ examId, isCorrect: false }),
        makeQuestion({ examId, isCorrect: false }),
      ]);

      // Only 2 credits remaining (need 3)
      creditRepo.findByUserId.mockResolvedValue(
        makeCredit({ userId, total: 30, used: 28 }),
      );

      await expect(useCase.execute({ userId, examId }))
        .rejects.toThrow(InsufficientCreditsError);

      // AI gateways should not be called
      expect(classifierGw.classifyBatch).not.toHaveBeenCalled();
      expect(explanationGw.diagnose).not.toHaveBeenCalled();
      expect(creditRepo.deduct).not.toHaveBeenCalled();
    });
  });
});
