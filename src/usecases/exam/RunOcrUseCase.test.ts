import type { IExamRepository, IQuestionRepository } from '@/domain/ports/repositories';
import type { IOcrGateway, IStorageGateway } from '@/domain/ports/gateways';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';
import { makeExam } from '@/__tests__/factories';
import { mockExamRepository, mockQuestionRepository } from '@/__tests__/mockBuilders';
import { mockOcrGateway, mockStorageGateway } from '@/__tests__/mockGateways';
import { RunOcrUseCase } from './RunOcrUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

// Mock global fetch for image download
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Save original Buffer.from, then mock it to return a predictable base64 string.
// We keep the real Buffer constructor intact so vitest's serializer
// (which does `val instanceof Buffer`) doesn't crash.
const originalBufferFrom = Buffer.from.bind(Buffer);
vi.spyOn(globalThis.Buffer, 'from').mockImplementation((...args: unknown[]) => {
  // When called with ArrayBuffer (from the fetch mock), return 'base64data'
  if (args[0] instanceof ArrayBuffer) {
    const buf = originalBufferFrom('base64data');
    return buf;
  }
  // Otherwise use real implementation
  return originalBufferFrom(...(args as Parameters<typeof Buffer.from>));
});

describe('RunOcrUseCase', () => {
  const userId = 'user-001';
  const examId = 'exam-001';

  let examRepo: Mocked<IExamRepository>;
  let questionRepo: Mocked<IQuestionRepository>;
  let ocrGw: Mocked<IOcrGateway>;
  let storageGw: Mocked<IStorageGateway>;
  let useCase: RunOcrUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    examRepo = mockExamRepository();
    questionRepo = mockQuestionRepository();
    ocrGw = mockOcrGateway();
    storageGw = mockStorageGateway();

    useCase = new RunOcrUseCase(examRepo, questionRepo, ocrGw, storageGw);

    // Default: exam exists, owned by user, status=processing, has imageUrl
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'processing', imageUrl: 'https://storage.example.com/exams/sample.jpg' }),
    );

    // Default fetch mock
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });

  it('runs OCR, creates questions, and updates exam status to ocr_done', async () => {
    const result = await useCase.execute({ userId, examId });

    // Signed URL was requested
    expect(storageGw.getSignedUrl).toHaveBeenCalledWith('https://storage.example.com/exams/sample.jpg');

    // Fetch was called with signed URL
    expect(mockFetch).toHaveBeenCalledWith('https://storage.example.com/signed/exam.jpg?token=abc');

    // OCR was called with base64-encoded string
    expect(ocrGw.processImage).toHaveBeenCalledWith('YmFzZTY0ZGF0YQ==');

    // OCR result was saved on exam
    expect(examRepo.update).toHaveBeenCalledWith(examId, expect.objectContaining({ ocrResult: expect.any(Object) }));

    // Questions were created
    expect(questionRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          examId,
          subject: 'math',
          number: 1,
          content: '$x^2 + 2x + 1 = 0$을 풀어라.',
          questionType: 'short_answer',
          answer: '-1',
          studentAnswer: null,
          isCorrect: null,
          points: 4,
        }),
      ]),
    );

    // Status was updated to ocr_done
    expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'ocr_done' });

    // Returns questions
    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('throws NotFoundError when exam does not exist', async () => {
    examRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute({ userId, examId })).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when userId does not match exam owner', async () => {
    await expect(
      useCase.execute({ userId: 'different-user', examId }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ValidationError when status cannot transition to ocr_done', async () => {
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'analyzed' }),
    );

    await expect(useCase.execute({ userId, examId })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ userId, examId })).rejects.toThrow(/Cannot transition/);
  });

  it('throws ValidationError when exam has no imageUrl', async () => {
    examRepo.findById.mockResolvedValue(
      makeExam({ id: examId, userId, status: 'processing', imageUrl: null }),
    );

    await expect(useCase.execute({ userId, examId })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ userId, examId })).rejects.toThrow(/no associated image/);
  });

  it('sets exam status to error and rethrows when OCR fails', async () => {
    ocrGw.processImage.mockRejectedValue(new Error('OCR service unavailable'));

    await expect(useCase.execute({ userId, examId })).rejects.toThrow('OCR service unavailable');

    // Status was set to error
    expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'error' });
  });

  it('sets exam status to error when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(useCase.execute({ userId, examId })).rejects.toThrow('Network error');

    expect(examRepo.update).toHaveBeenCalledWith(examId, { status: 'error' });
  });

  it('maps OCR question data correctly when creating questions', async () => {
    ocrGw.processImage.mockResolvedValue({
      questions: [
        {
          number: 1,
          content: 'Question 1',
          type: 'multiple_choice',
          options: ['A', 'B', 'C', 'D'],
          answer: '2',
          points: 3,
          needsReview: false,
        },
        {
          number: 2,
          content: 'Question 2',
          type: 'short_answer',
          options: null,
          answer: '42',
          points: 5,
          needsReview: false,
        },
      ],
      metadata: { totalQuestions: 2, pageNumber: 1, confidence: 0.9 },
    });

    await useCase.execute({ userId, examId });

    expect(questionRepo.createMany).toHaveBeenCalledWith([
      {
        examId,
        subject: 'math',
        number: 1,
        content: 'Question 1',
        questionType: 'multiple_choice',
        options: ['A', 'B', 'C', 'D'],
        answer: '2',
        studentAnswer: null,
        isCorrect: null,
        points: 3,
      },
      {
        examId,
        subject: 'math',
        number: 2,
        content: 'Question 2',
        questionType: 'short_answer',
        options: null,
        answer: '42',
        studentAnswer: null,
        isCorrect: null,
        points: 5,
      },
    ]);
  });
});
