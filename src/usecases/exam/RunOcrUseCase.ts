import type { UseCase } from '@/shared/types';
import type { Question } from '@/domain/entities';
import type { IExamRepository, IQuestionRepository } from '@/domain/ports/repositories';
import type { IOcrGateway, IStorageGateway } from '@/domain/ports/gateways';
import { canTransitionStatus } from '@/domain/rules/examRules';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors';

export interface RunOcrInput {
  userId: string;
  examId: string;
}

export interface RunOcrOutput {
  questions: Question[];
}

export class RunOcrUseCase implements UseCase<RunOcrInput, RunOcrOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly ocrGateway: IOcrGateway,
    private readonly storageGateway: IStorageGateway,
  ) {}

  async execute(input: RunOcrInput): Promise<RunOcrOutput> {
    const { userId, examId } = input;

    // 1. Fetch exam and verify ownership
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new NotFoundError('Exam', examId);
    }

    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    // 2. Verify status transition
    if (!canTransitionStatus(exam.status, 'ocr_done')) {
      throw new ValidationError(
        `Cannot transition exam status from '${exam.status}' to 'ocr_done'`,
      );
    }

    // 3. Validate exam has an associated image
    if (!exam.imageUrl) {
      throw new ValidationError('Exam has no associated image');
    }

    try {
      // 4. Get signed URL for exam image
      const signedUrl = await this.storageGateway.getSignedUrl(exam.imageUrl);

      // 4. Fetch image and convert to base64
      const response = await fetch(signedUrl);
      const arrayBuffer = await response.arrayBuffer();
      const imageBase64 = Buffer.from(arrayBuffer).toString('base64');

      // 5. Run OCR
      const ocrResult = await this.ocrGateway.processImage(imageBase64);

      // 6. Save OCR result on exam
      await this.examRepo.update(examId, { ocrResult });

      // 7. Create Question rows from OCR result
      const questionData = ocrResult.questions.map((q) => ({
        examId,
        subject: exam.subject,
        number: q.number,
        content: q.content,
        questionType: q.type,
        options: q.options,
        answer: q.answer,
        studentAnswer: null,
        isCorrect: null,
        points: q.points,
      }));

      const questions = await this.questionRepo.createMany(questionData);

      // 8. Update exam status to 'ocr_done'
      await this.examRepo.update(examId, { status: 'ocr_done' });

      return { questions };
    } catch (error) {
      // If OCR fails, set status to 'error' and rethrow
      try {
        await this.examRepo.update(examId, { status: 'error' });
      } catch {
        // Ignore error update failure — preserve original error
      }
      throw error;
    }
  }
}
