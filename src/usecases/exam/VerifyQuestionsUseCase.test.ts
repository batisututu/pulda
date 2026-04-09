import type { IExamRepository, IQuestionRepository } from '@/domain/ports/repositories';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';
import { makeExam } from '@/__tests__/factories';
import { mockExamRepository, mockQuestionRepository } from '@/__tests__/mockBuilders';
import { VerifyQuestionsUseCase } from './VerifyQuestionsUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('VerifyQuestionsUseCase', () => {
  const userId = 'user-001';
  const examId = 'exam-001';

  let examRepo: Mocked<IExamRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let useCase: VerifyQuestionsUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    examRepo = mockExamRepository();
    questionRepo = mockQuestionRepository();

    useCase = new VerifyQuestionsUseCase(examRepo, questionRepo);

    // Default: exam exists, owned by user, status=ocr_done
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'ocr_done' }),
    );
  });

  it('updates questions with isCorrect computed via checkAnswer and sets status to verified', async () => {
    const questions = [
      {
        id: 'q-1',
        questionType: 'multiple_choice' as const,
        answer: '3',
        studentAnswer: '3',
      },
      {
        id: 'q-2',
        questionType: 'short_answer' as const,
        answer: '-1',
        studentAnswer: '2',
      },
    ];

    const result = await useCase.execute({ userId, examId, questions });

    expect(result.examId).toBe(examId);
    expect(result.status).toBe('verified');

    // updateMany was called with computed isCorrect values
    expect(questionRepo.updateMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'q-1',
          data: expect.objectContaining({
            studentAnswer: '3',
            answer: '3',
            isCorrect: true, // MC: 3 === 3
          }),
        }),
        expect.objectContaining({
          id: 'q-2',
          data: expect.objectContaining({
            studentAnswer: '2',
            answer: '-1',
            isCorrect: false, // short_answer: '2' !== '-1'
          }),
        }),
      ]),
    );

    // Exam status updated to verified
    expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'verified' });
  });

  it('throws NotFoundError when exam does not exist', async () => {
    examRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId, examId, questions: [] }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user does not own the exam', async () => {
    await expect(
      useCase.execute({ userId: 'different-user', examId, questions: [] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ValidationError when status cannot transition to verified', async () => {
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'processing' }),
    );

    await expect(
      useCase.execute({ userId, examId, questions: [] }),
    ).rejects.toThrow(ValidationError);
  });

  it('does not call updateMany when questions array is empty, but still updates status', async () => {
    const result = await useCase.execute({ userId, examId, questions: [] });

    expect(questionRepo.updateMany).not.toHaveBeenCalled();
    expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'verified' });
    expect(result.status).toBe('verified');
  });

  it('computes isCorrect correctly for multiple choice (numeric comparison)', async () => {
    const questions = [
      { id: 'q-1', questionType: 'multiple_choice' as const, answer: '2', studentAnswer: '2' },
      { id: 'q-2', questionType: 'multiple_choice' as const, answer: '3', studentAnswer: '1' },
    ];

    await useCase.execute({ userId, examId, questions });

    const calls = questionRepo.updateMany.mock.calls[0][0];
    const q1Update = calls.find((u: { id: string }) => u.id === 'q-1');
    const q2Update = calls.find((u: { id: string }) => u.id === 'q-2');

    expect(q1Update.data.isCorrect).toBe(true);
    expect(q2Update.data.isCorrect).toBe(false);
  });

  it('includes only defined fields in update data (partial updates)', async () => {
    const questions = [
      {
        id: 'q-1',
        // Only studentAnswer is provided — other fields are undefined
        studentAnswer: '5',
      },
    ];

    await useCase.execute({ userId, examId, questions });

    const calls = questionRepo.updateMany.mock.calls[0][0];
    const update = calls[0];

    // studentAnswer should be present
    expect(update.data.studentAnswer).toBe('5');
    // Fields that were undefined should not be present in data
    expect(update.data).not.toHaveProperty('content');
    expect(update.data).not.toHaveProperty('questionType');
    expect(update.data).not.toHaveProperty('options');
  });
});
