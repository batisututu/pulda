import type { UseCase } from '@/shared/types';
import type { ExamStatus, QuestionType } from '@/domain/value-objects';
import type { IExamRepository, IQuestionRepository } from '@/domain/ports/repositories';
import { canTransitionStatus } from '@/domain/rules/examRules';
import { checkAnswer } from '@/domain/rules/scoringRules';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors';

export interface VerifyQuestionsInput {
  userId: string;
  examId: string;
  questions: Array<{
    id: string;
    content?: string;
    questionType?: QuestionType;
    options?: string[] | null;
    answer?: string | null;
    studentAnswer?: string | null;
    points?: number | null;
  }>;
}

export interface VerifyQuestionsOutput {
  examId: string;
  status: ExamStatus;
}

export class VerifyQuestionsUseCase implements UseCase<VerifyQuestionsInput, VerifyQuestionsOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly questionRepo: IQuestionRepository,
  ) {}

  async execute(input: VerifyQuestionsInput): Promise<VerifyQuestionsOutput> {
    const { userId, examId, questions } = input;

    // 1. Fetch exam and verify ownership
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new NotFoundError('Exam', examId);
    }

    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    // 2. Verify status transition
    if (!canTransitionStatus(exam.status, 'verified')) {
      throw new ValidationError(
        `Cannot transition exam status from '${exam.status}' to 'verified'`,
      );
    }

    // 3. Update modified questions (with student answer and correctness)
    if (questions.length > 0) {
      const updates = questions.map((q) => {
        // Compute isCorrect if studentAnswer is provided
        const isCorrect = q.studentAnswer !== undefined
          ? checkAnswer(
              q.questionType ?? 'short_answer',
              q.studentAnswer ?? null,
              q.answer ?? null,
            )
          : undefined;

        return {
          id: q.id,
          data: {
            ...(q.content !== undefined && { content: q.content }),
            ...(q.questionType !== undefined && { questionType: q.questionType }),
            ...(q.options !== undefined && { options: q.options }),
            ...(q.answer !== undefined && { answer: q.answer }),
            ...(q.studentAnswer !== undefined && { studentAnswer: q.studentAnswer }),
            ...(isCorrect !== undefined && { isCorrect }),
            ...(q.points !== undefined && { points: q.points }),
          },
        };
      });

      await this.questionRepo.updateMany(updates);
    }

    // 4. Update exam status to 'verified'
    await this.examRepo.update(examId, { status: 'verified' });

    return { examId, status: 'verified' };
  }
}
