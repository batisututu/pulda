import type {
  IDiagnosisRepository,
  IQuestionRepository,
  IExamRepository,
  IVariantRepository,
  ICreditRepository,
} from '@/domain/ports/repositories';
import type { IVariantGeneratorGateway } from '@/domain/ports/gateways';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';
import { makeExam, makeQuestion, makeErrorDiagnosis } from '@/__tests__/factories';
import {
  mockDiagnosisRepository,
  mockQuestionRepository,
  mockExamRepository,
  mockVariantRepository,
  mockCreditRepository,
} from '@/__tests__/mockBuilders';
import { mockVariantGeneratorGateway } from '@/__tests__/mockGateways';
import { GenerateVariantsUseCase } from './GenerateVariantsUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('GenerateVariantsUseCase', () => {
  const userId = 'user-001';
  const examId = 'exam-001';
  const questionId = 'question-001';
  const diagnosisId = 'diagnosis-001';

  let diagnosisRepo: Mocked<IDiagnosisRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let examRepo: Mocked<IExamRepository>;
  let variantRepo: Mocked<IVariantRepository>;
  let creditRepo: Mocked<ICreditRepository>;
  let variantGenGw: Mocked<IVariantGeneratorGateway>;
  let useCase: GenerateVariantsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    diagnosisRepo = mockDiagnosisRepository();
    questionRepo = mockQuestionRepository();
    examRepo = mockExamRepository();
    variantRepo = mockVariantRepository();
    creditRepo = mockCreditRepository();
    variantGenGw = mockVariantGeneratorGateway();

    useCase = new GenerateVariantsUseCase(
      diagnosisRepo,
      questionRepo,
      examRepo,
      variantRepo,
      creditRepo,
      variantGenGw,
    );

    // Default chain: diagnosis -> question -> exam (owned by userId)
    const diagnosis = makeErrorDiagnosis({ id: diagnosisId, questionId });
    const question = makeQuestion({ id: questionId, examId });
    const exam = makeExam({ id: examId, userId });

    diagnosisRepo.findById.mockResolvedValue(diagnosis);
    questionRepo.findById.mockResolvedValue(question);
    examRepo.findById.mockResolvedValue(exam);
  });

  it('generates and persists variants for a valid diagnosis chain', async () => {
    const result = await useCase.execute({ userId, diagnosisId, count: 3 });

    // AI gateway was called
    expect(variantGenGw.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: diagnosisId }),
      expect.objectContaining({ id: questionId }),
      3,
    );

    // Variants were persisted
    expect(variantRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosisId,
          userId: null,
          topic: null,
          grade: null,
        }),
      ]),
    );

    expect(result.diagnosisId).toBe(diagnosisId);
    expect(result.variants).toBeDefined();
    expect(result.creditsUsed).toBe(0);
  });

  it('throws ValidationError for count=0', async () => {
    await expect(
      useCase.execute({ userId, diagnosisId, count: 0 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for count=6', async () => {
    await expect(
      useCase.execute({ userId, diagnosisId, count: 6 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when diagnosis is not found', async () => {
    diagnosisRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, diagnosisId, count: 3 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when question is not found', async () => {
    questionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, diagnosisId, count: 3 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when exam is not found', async () => {
    examRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, diagnosisId, count: 3 }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user does not own the exam', async () => {
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId: 'different-user' }),
    );

    await expect(
      useCase.execute({ userId, diagnosisId, count: 3 }),
    ).rejects.toThrow(ForbiddenError);
  });
});
