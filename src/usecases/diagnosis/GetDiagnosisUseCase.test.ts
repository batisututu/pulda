import type { IExamRepository } from '@/domain/ports/repositories/IExamRepository';
import type { IQuestionRepository } from '@/domain/ports/repositories/IQuestionRepository';
import type { IDiagnosisRepository } from '@/domain/ports/repositories/IDiagnosisRepository';
import type { IVariantRepository } from '@/domain/ports/repositories/IVariantRepository';
import type { IBlueprintRepository } from '@/domain/ports/repositories/IBlueprintRepository';
import { NotFoundError, ForbiddenError } from '@/shared/errors';
import {
  makeExam,
  makeQuestion,
  makeBlueprint,
  makeErrorDiagnosis,
  makeVariantQuestion,
} from '@/__tests__/factories';
import {
  mockExamRepository,
  mockQuestionRepository,
  mockDiagnosisRepository,
  mockVariantRepository,
  mockBlueprintRepository,
} from '@/__tests__/mockBuilders';
import { GetDiagnosisUseCase } from './GetDiagnosisUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('GetDiagnosisUseCase', () => {
  const userId = 'user-001';
  const examId = 'exam-001';

  let examRepo: Mocked<IExamRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let diagnosisRepo: Mocked<IDiagnosisRepository>;
  let variantRepo: Mocked<IVariantRepository>;
  let blueprintRepo: Mocked<IBlueprintRepository>;
  let useCase: GetDiagnosisUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    examRepo = mockExamRepository() as Mocked<IExamRepository>;
    questionRepo = mockQuestionRepository() as Mocked<IQuestionRepository>;
    diagnosisRepo = mockDiagnosisRepository() as Mocked<IDiagnosisRepository>;
    variantRepo = mockVariantRepository() as Mocked<IVariantRepository>;
    blueprintRepo = mockBlueprintRepository() as Mocked<IBlueprintRepository>;

    // Default: exam exists and belongs to userId
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'analyzed' }),
    );

    useCase = new GetDiagnosisUseCase(
      examRepo,
      questionRepo,
      diagnosisRepo,
      variantRepo,
      blueprintRepo,
    );
  });

  it('happy path: returns enriched diagnoses with summary', async () => {
    const correctQ = makeQuestion({ id: 'q1', examId, isCorrect: true });
    const wrongQ = makeQuestion({ id: 'q2', examId, isCorrect: false });
    const blueprint = makeBlueprint({ examId });
    const diagnosis = makeErrorDiagnosis({ id: 'diag-1', questionId: 'q2' });
    const variant = makeVariantQuestion({ diagnosisId: 'diag-1' });

    questionRepo.findByExamId.mockResolvedValue([correctQ, wrongQ]);
    blueprintRepo.findByExamId.mockResolvedValue(blueprint);
    diagnosisRepo.findByExamId.mockResolvedValue([diagnosis]);
    variantRepo.findByDiagnosisIds.mockResolvedValue([variant]);

    const result = await useCase.execute({ userId, examId });

    expect(result.examId).toBe(examId);
    expect(result.blueprint).toEqual(blueprint);
    expect(result.diagnoses).toHaveLength(1);
    expect(result.diagnoses[0].question.id).toBe('q2');
    expect(result.diagnoses[0].variants).toHaveLength(1);
    expect(result.summary).toEqual({
      totalQuestions: 2,
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 0,
      accuracy: 0.5,
    });
  });

  it('throws NotFoundError when exam not found', async () => {
    examRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, examId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user does not own the exam', async () => {
    await expect(
      useCase.execute({ userId: 'different-user', examId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('handles no diagnoses: empty array with correct summary', async () => {
    const q1 = makeQuestion({ id: 'q1', examId, isCorrect: true });
    const q2 = makeQuestion({ id: 'q2', examId, isCorrect: true });

    questionRepo.findByExamId.mockResolvedValue([q1, q2]);
    diagnosisRepo.findByExamId.mockResolvedValue([]);
    blueprintRepo.findByExamId.mockResolvedValue(null);

    const result = await useCase.execute({ userId, examId });

    expect(result.diagnoses).toEqual([]);
    expect(result.summary).toEqual({
      totalQuestions: 2,
      correctCount: 2,
      wrongCount: 0,
      unansweredCount: 0,
      accuracy: 1,
    });
  });

  it('returns null blueprint when none exists', async () => {
    questionRepo.findByExamId.mockResolvedValue([]);
    diagnosisRepo.findByExamId.mockResolvedValue([]);
    blueprintRepo.findByExamId.mockResolvedValue(null);

    const result = await useCase.execute({ userId, examId });

    expect(result.blueprint).toBeNull();
  });

  it('throws NotFoundError when diagnosis references nonexistent question', async () => {
    const diagnosis = makeErrorDiagnosis({ id: 'diag-1', questionId: 'missing-q' });

    questionRepo.findByExamId.mockResolvedValue([]);
    diagnosisRepo.findByExamId.mockResolvedValue([diagnosis]);
    blueprintRepo.findByExamId.mockResolvedValue(null);
    questionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, examId }),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns accuracy 0 when totalQuestions is 0', async () => {
    questionRepo.findByExamId.mockResolvedValue([]);
    diagnosisRepo.findByExamId.mockResolvedValue([]);
    blueprintRepo.findByExamId.mockResolvedValue(null);

    const result = await useCase.execute({ userId, examId });

    expect(result.summary.accuracy).toBe(0);
    expect(result.summary.totalQuestions).toBe(0);
  });

  it('counts unanswered questions (isCorrect=null)', async () => {
    const correctQ = makeQuestion({ id: 'q1', examId, isCorrect: true });
    const wrongQ = makeQuestion({ id: 'q2', examId, isCorrect: false });
    const unansweredQ = makeQuestion({
      id: 'q3',
      examId,
      isCorrect: null,
      studentAnswer: null,
    });

    questionRepo.findByExamId.mockResolvedValue([correctQ, wrongQ, unansweredQ]);
    diagnosisRepo.findByExamId.mockResolvedValue([]);
    blueprintRepo.findByExamId.mockResolvedValue(null);

    const result = await useCase.execute({ userId, examId });

    expect(result.summary).toEqual({
      totalQuestions: 3,
      correctCount: 1,
      wrongCount: 1,
      unansweredCount: 1,
      accuracy: 1 / 3,
    });
  });
});
