import type { IExamRepository } from '@/domain/ports/repositories/IExamRepository';
import type { IQuestionRepository } from '@/domain/ports/repositories/IQuestionRepository';
import type { IBlueprintRepository } from '@/domain/ports/repositories/IBlueprintRepository';
import type { IDiagnosisRepository } from '@/domain/ports/repositories/IDiagnosisRepository';
import type { IVariantRepository } from '@/domain/ports/repositories/IVariantRepository';
import type { ICreditRepository } from '@/domain/ports/repositories/ICreditRepository';
import type { ICacheRepository } from '@/domain/ports/repositories/ICacheRepository';
import type { IUserRepository } from '@/domain/ports/repositories/IUserRepository';
import type { Exam, Question, QuestionCache } from '@/domain/entities';
import {
  ForbiddenError,
  ValidationError,
  ExpiredError,
  PipelineStageError,
  InsufficientCreditsError,
  NotFoundError,
} from '@/shared/errors';
import { makeExam, makeQuestion, makeUser } from '@/__tests__/factories';
import {
  mockClassifierGateway,
  mockExplanationGateway,
  mockVerifierGateway,
  mockVariantGeneratorGateway,
} from '@/__tests__/mockGateways';
import { AnalyzeExamUseCase } from './AnalyzeExamUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

// --- Mock repository builders for repositories NOT in mockBuilders.ts ---

function mockExamRepository(): Mocked<IExamRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((exam) =>
      Promise.resolve({
        ...exam,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    ),
    update: vi.fn().mockImplementation((id, data) =>
      Promise.resolve({ id, ...data }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function mockQuestionRepository(): Mocked<IQuestionRepository> {
  return {
    findByExamId: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((q) =>
      Promise.resolve({
        ...q,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    ),
    createMany: vi.fn().mockImplementation((qs) =>
      Promise.resolve(
        qs.map((q: Record<string, unknown>) => ({
          ...q,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        })),
      ),
    ),
    updateMany: vi.fn().mockResolvedValue(undefined),
    deleteByExamId: vi.fn().mockResolvedValue(undefined),
  };
}

function mockBlueprintRepository(): Mocked<IBlueprintRepository> {
  return {
    findByExamId: vi.fn().mockResolvedValue(null),
    findByExamIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((bp) =>
      Promise.resolve({
        ...bp,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    ),
  };
}

function mockDiagnosisRepository(): Mocked<IDiagnosisRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByQuestionId: vi.fn().mockResolvedValue(null),
    findByExamId: vi.fn().mockResolvedValue([]),
    findByExamIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((d) =>
      Promise.resolve({
        ...d,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    ),
    createMany: vi.fn().mockImplementation((ds) =>
      Promise.resolve(
        ds.map((d: Record<string, unknown>) => ({
          ...d,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        })),
      ),
    ),
  };
}

function mockCacheRepository(): Mocked<ICacheRepository> {
  return {
    findByHash: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation((hash, data) =>
      Promise.resolve({
        id: crypto.randomUUID(),
        contentHash: hash,
        classification: null,
        explanation: null,
        hitCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      }),
    ),
    incrementHitCount: vi.fn().mockResolvedValue(undefined),
  };
}

function mockVariantRepository(): Mocked<IVariantRepository> {
  return {
    findByDiagnosisId: vi.fn().mockResolvedValue([]),
    findByDiagnosisIds: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((v) =>
      Promise.resolve({
        ...v,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }),
    ),
    createMany: vi.fn().mockImplementation((vs) =>
      Promise.resolve(
        vs.map((v: Record<string, unknown>) => ({
          ...v,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        })),
      ),
    ),
  };
}

function mockLocalCreditRepository(): Mocked<ICreditRepository> {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    deduct: vi.fn().mockImplementation((userId, amount) =>
      Promise.resolve({
        id: crypto.randomUUID(),
        userId,
        plan: 'free',
        total: 30,
        used: amount,
        resetAt: new Date().toISOString(),
      }),
    ),
    reset: vi.fn().mockImplementation((userId, plan) =>
      Promise.resolve({
        id: crypto.randomUUID(),
        userId,
        plan,
        total: 30,
        used: 0,
        resetAt: new Date().toISOString(),
      }),
    ),
    update: vi.fn().mockImplementation((userId, data) =>
      Promise.resolve({
        id: crypto.randomUUID(),
        userId,
        ...data,
      }),
    ),
  };
}

function mockLocalUserRepository(): Mocked<IUserRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAuthId: vi.fn().mockResolvedValue(null),
    findByNickname: vi.fn().mockResolvedValue([]),
    findByIds: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockImplementation((id, data) =>
      Promise.resolve({ id, ...data }),
    ),
  };
}

// --- Test suite ---

describe('AnalyzeExamUseCase', () => {
  // Shared test state
  const userId = 'user-001';
  const examId = 'exam-001';

  let examRepo: Mocked<IExamRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let blueprintRepo: Mocked<IBlueprintRepository>;
  let diagnosisRepo: Mocked<IDiagnosisRepository>;
  let variantRepo: Mocked<IVariantRepository>;
  let creditRepo: Mocked<ICreditRepository>;
  let cacheRepo: Mocked<ICacheRepository>;
  let userRepo: Mocked<IUserRepository>;
  let classifierGw: ReturnType<typeof mockClassifierGateway>;
  let explanationGw: ReturnType<typeof mockExplanationGateway>;
  let verifierGw: ReturnType<typeof mockVerifierGateway>;
  let variantGenGw: ReturnType<typeof mockVariantGeneratorGateway>;
  let useCase: AnalyzeExamUseCase;

  // Shared test data
  let exam: Exam;
  let correctQuestion: Question;
  let wrongQuestion: Question;
  let allQuestions: Question[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Repositories
    examRepo = mockExamRepository();
    questionRepo = mockQuestionRepository();
    blueprintRepo = mockBlueprintRepository();
    diagnosisRepo = mockDiagnosisRepository();
    variantRepo = mockVariantRepository();
    creditRepo = mockLocalCreditRepository();
    cacheRepo = mockCacheRepository();
    userRepo = mockLocalUserRepository();

    // Gateways
    classifierGw = mockClassifierGateway();
    explanationGw = mockExplanationGateway();
    verifierGw = mockVerifierGateway();
    variantGenGw = mockVariantGeneratorGateway();

    // Test data
    exam = makeExam({
      id: examId,
      userId,
      status: 'verified',
    });

    correctQuestion = makeQuestion({
      id: 'q-correct-1',
      examId,
      number: 1,
      content: '$2 + 3 = ?$',
      isCorrect: true,
      studentAnswer: '5',
      answer: '5',
    });

    wrongQuestion = makeQuestion({
      id: 'q-wrong-1',
      examId,
      number: 2,
      content: '$x^2 + 2x + 1 = 0$을 풀어라.',
      isCorrect: false,
      studentAnswer: '1',
      answer: '-1',
    });

    allQuestions = [correctQuestion, wrongQuestion];

    // Default mock setups
    examRepo.findById.mockResolvedValue(exam);
    questionRepo.findByExamId.mockResolvedValue(allQuestions);
    userRepo.findById.mockResolvedValue(makeUser({ id: userId, grade: 'high1' }));
    creditRepo.findByUserId.mockResolvedValue({
      id: 'credit-001',
      userId,
      plan: 'free',
      total: 30,
      used: 0,
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // explanationGateway returns with proper questionId
    explanationGw.diagnose.mockImplementation((question) =>
      Promise.resolve({
        questionId: question.id,
        errorType: 'concept_gap',
        confidence: 0.85,
        correctAnswer: '-1',
        stepByStep: '1단계: $(x+1)^2 = 0$\n2단계: $x = -1$',
        errorReasoning: '인수분해 개념 부족',
        correctionGuidance: '완전제곱식 학습 필요',
        verification: { verified: true, verifierAnswer: '-1', match: true },
      }),
    );

    // Create the use case
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
  });

  describe('full pipeline', () => {
    it('classifies questions, diagnoses wrong ones, and generates variants', async () => {
      const result = await useCase.execute({ userId, examId });

      // L2: classifyBatch was called with all questions
      expect(classifierGw.classifyBatch).toHaveBeenCalledWith(
        allQuestions,
        'high1',
      );
      expect(classifierGw.generateBlueprint).toHaveBeenCalledOnce();

      // L3: explanation + verification only for wrong questions
      expect(explanationGw.diagnose).toHaveBeenCalledOnce();
      expect(explanationGw.diagnose).toHaveBeenCalledWith(
        wrongQuestion,
        '1', // studentAnswer
        expect.objectContaining({ questionId: wrongQuestion.id }),
        'high1',
      );
      expect(verifierGw.verify).toHaveBeenCalledOnce();
      expect(verifierGw.verify).toHaveBeenCalledWith(wrongQuestion);

      // L4: variants generated per diagnosis
      expect(variantGenGw.generate).toHaveBeenCalledOnce();
      expect(variantGenGw.generate).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: wrongQuestion.id }),
        wrongQuestion,
        3, // DEFAULT_VARIANT_COUNT
      );

      // Diagnosis persisted
      expect(diagnosisRepo.create).toHaveBeenCalledOnce();

      // Variants persisted
      expect(variantRepo.createMany).toHaveBeenCalledOnce();

      // Status updated to 'analyzed'
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'analyzed' });

      // Result structure
      expect(result.examId).toBe(examId);
      expect(result.status).toBe('analyzed');
      expect(result.blueprint).toBeDefined();
      expect(result.diagnoses).toHaveLength(1);
      expect(result.diagnoses[0].question.id).toBe(wrongQuestion.id);
      expect(result.variants).toHaveLength(3);

      // Summary statistics
      expect(result.summary.totalQuestions).toBe(2);
      expect(result.summary.correctCount).toBe(1);
      expect(result.summary.wrongCount).toBe(1);
      expect(result.summary.accuracy).toBe(0.5);
    });
  });

  describe('cache behavior', () => {
    it('uses cached classification when available', async () => {
      const cachedClassification = {
        questionId: correctQuestion.id,
        subject: '수학',
        unit: '기본연산',
        subUnit: '덧셈',
        difficulty: 'easy' as const,
        questionType: 'short_answer' as const,
        reasoning: '기본 연산 문제',
      };

      // Both questions have cache entries; correct one has cached classification
      cacheRepo.findByHash.mockImplementation((hash: string) => {
        // We cannot easily predict hash values, so return cache for all calls
        // The first call is for correctQuestion, second for wrongQuestion
        const callCount = cacheRepo.findByHash.mock.calls.length;
        if (callCount <= 1) {
          return Promise.resolve({
            id: 'cache-1',
            contentHash: hash,
            classification: cachedClassification,
            explanation: null,
            hitCount: 5,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as QuestionCache);
        }
        return Promise.resolve(null);
      });

      const result = await useCase.execute({ userId, examId });

      // Cache hit was counted
      expect(result.cacheHits).toBe(1);
      expect(cacheRepo.incrementHitCount).toHaveBeenCalledWith('cache-1');

      // Only 1 question needed classification (the wrongQuestion without cache)
      expect(classifierGw.classifyBatch).toHaveBeenCalledWith(
        [wrongQuestion],
        'high1',
      );
    });
  });

  describe('partial failures', () => {
    it('handles partial failures when some diagnoses fail but others succeed', async () => {
      // Add a second wrong question
      const wrongQuestion2 = makeQuestion({
        id: 'q-wrong-2',
        examId,
        number: 3,
        content: '$\\sqrt{16} = ?$',
        isCorrect: false,
        studentAnswer: '8',
        answer: '4',
      });

      const questionsWithTwo = [correctQuestion, wrongQuestion, wrongQuestion2];
      questionRepo.findByExamId.mockResolvedValue(questionsWithTwo);

      // First wrong question succeeds, second fails
      let callCount = 0;
      explanationGw.diagnose.mockImplementation((question) => {
        callCount++;
        if (question.id === wrongQuestion2.id) {
          return Promise.reject(new Error('AI service timeout'));
        }
        return Promise.resolve({
          questionId: question.id,
          errorType: 'concept_gap' as const,
          confidence: 0.85,
          correctAnswer: '-1',
          stepByStep: '풀이 과정',
          errorReasoning: '오답 원인',
          correctionGuidance: '교정 안내',
          verification: { verified: true, verifierAnswer: '-1', match: true },
        });
      });

      const result = await useCase.execute({ userId, examId });

      // One diagnosis succeeded, the other failed but pipeline continues
      expect(result.diagnoses).toHaveLength(1);
      expect(result.diagnoses[0].question.id).toBe(wrongQuestion.id);

      // Status still updated to 'analyzed' (partial success is OK)
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'analyzed' });
    });

    it('throws PipelineStageError when all diagnoses fail', async () => {
      explanationGw.diagnose.mockRejectedValue(new Error('AI service unavailable'));

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(PipelineStageError);

      // Status updated to 'error'
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'error' });
    });
  });

  describe('validation', () => {
    it('throws ForbiddenError when user does not own the exam', async () => {
      await expect(
        useCase.execute({ userId: 'different-user', examId }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ValidationError if exam status is not verified', async () => {
      examRepo.findById.mockResolvedValue(
        makeExam({ id: examId, userId, status: 'processing' }),
      );

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if exam status is completed (already past analyzed)', async () => {
      examRepo.findById.mockResolvedValue(
        makeExam({ id: examId, userId, status: 'completed' }),
      );

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(ValidationError);
    });

    it('resets error status to verified for retry', async () => {
      examRepo.findById.mockResolvedValue(
        makeExam({ id: examId, userId, status: 'error' }),
      );

      const result = await useCase.execute({ userId, examId });

      // First update: reset 'error' to 'verified'
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'verified' });
      // Last update: set to 'analyzed'
      expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'analyzed' });
      expect(result.status).toBe('analyzed');
    });

    it('throws ExpiredError for expired exam', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      examRepo.findById.mockResolvedValue(
        makeExam({
          id: examId,
          userId,
          status: 'verified',
          expiresAt: pastDate.toISOString(),
        }),
      );

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(ExpiredError);
    });
  });

  describe('summary statistics', () => {
    it('returns correct summary statistics', async () => {
      // Add unanswered question (isCorrect: null)
      const unansweredQuestion = makeQuestion({
        id: 'q-unanswered-1',
        examId,
        number: 3,
        content: '$\\int x^2 dx$',
        isCorrect: null,
        studentAnswer: null,
        answer: '$\\frac{x^3}{3} + C$',
      });

      const allQs = [correctQuestion, wrongQuestion, unansweredQuestion];
      questionRepo.findByExamId.mockResolvedValue(allQs);

      const result = await useCase.execute({ userId, examId });

      expect(result.summary).toEqual({
        totalQuestions: 3,
        correctCount: 1,
        wrongCount: 1,
        unansweredCount: 1,
        accuracy: 1 / 3,
      });
    });

    it('returns zero accuracy when there are no questions', async () => {
      questionRepo.findByExamId.mockResolvedValue([]);

      const result = await useCase.execute({ userId, examId });

      expect(result.summary.accuracy).toBe(0);
      expect(result.summary.totalQuestions).toBe(0);
    });
  });

  describe('exam not found', () => {
    it('throws NotFoundError when exam does not exist', async () => {
      examRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ userId, examId: 'nonexistent' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('blueprint idempotency', () => {
    it('reuses existing blueprint on re-run', async () => {
      const existingBlueprint = {
        id: 'bp-existing',
        examId,
        unitDistribution: { '이차방정식': 1.0 },
        typeDistribution: { short_answer: 1.0 },
        difficultyDistribution: { medium: 1.0 },
        insights: ['기존 블루프린트'],
        createdAt: new Date().toISOString(),
      };

      blueprintRepo.findByExamId.mockResolvedValue(existingBlueprint);

      const result = await useCase.execute({ userId, examId });

      expect(result.blueprint.id).toBe('bp-existing');
      expect(blueprintRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('user grade fallback', () => {
    it('defaults to high1 when user has no grade', async () => {
      userRepo.findById.mockResolvedValue(makeUser({ id: userId, grade: null }));

      await useCase.execute({ userId, examId });

      expect(classifierGw.classifyBatch).toHaveBeenCalledWith(
        allQuestions,
        'high1',
      );
    });

    it('defaults to high1 when user is not found', async () => {
      userRepo.findById.mockResolvedValue(null);

      await useCase.execute({ userId, examId });

      expect(classifierGw.classifyBatch).toHaveBeenCalledWith(
        allQuestions,
        'high1',
      );
    });
  });

  describe('cache upsert on classification', () => {
    it('saves classification results to cache', async () => {
      await useCase.execute({ userId, examId });

      // Cache upsert called for each uncached question's classification
      expect(cacheRepo.upsert).toHaveBeenCalled();
      const upsertCalls = cacheRepo.upsert.mock.calls;

      // At least one call should include a classification result
      const hasClassificationUpsert = upsertCalls.some(
        (call) => call[1]?.classification != null,
      );
      expect(hasClassificationUpsert).toBe(true);
    });
  });

  describe('credit checks and deduction', () => {
    it('throws InsufficientCreditsError when credits are not enough', async () => {
      creditRepo.findByUserId.mockResolvedValue({
        id: 'credit-001',
        userId,
        plan: 'free',
        total: 30,
        used: 30, // fully used
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(InsufficientCreditsError);
    });

    it('throws NotFoundError when credit record does not exist', async () => {
      creditRepo.findByUserId.mockResolvedValue(null);

      await expect(useCase.execute({ userId, examId })).rejects.toThrow(NotFoundError);
    });

    it('deducts credits after successful analysis', async () => {
      const result = await useCase.execute({ userId, examId });

      // 1 wrong question, 0 cache hits = 1 credit deducted
      expect(creditRepo.deduct).toHaveBeenCalledWith(userId, 1);
      expect(result.creditsUsed).toBe(1);
    });

    it('does not deduct credits when all questions are cached', async () => {
      // Make all questions return cached data
      cacheRepo.findByHash.mockImplementation((hash: string) =>
        Promise.resolve({
          id: 'cache-1',
          contentHash: hash,
          classification: {
            questionId: 'q-1',
            subject: '수학',
            unit: '기본연산',
            subUnit: '덧셈',
            difficulty: 'easy' as const,
            questionType: 'short_answer' as const,
            reasoning: '기본',
          },
          explanation: {
            questionId: 'q-1',
            errorType: 'concept_gap' as const,
            confidence: 0.85,
            correctAnswer: '-1',
            stepByStep: '풀이',
            errorReasoning: '원인',
            correctionGuidance: '교정',
            verification: { verified: true, verifierAnswer: '-1', match: true },
          },
          hitCount: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );

      const result = await useCase.execute({ userId, examId });

      // All cached: no credits deducted
      expect(creditRepo.deduct).not.toHaveBeenCalled();
      expect(result.creditsUsed).toBe(0);
    });
  });
});
