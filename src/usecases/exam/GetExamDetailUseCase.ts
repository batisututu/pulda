import type { UseCase } from '@/shared/types';
import type { Exam } from '@/domain/entities';
import type { IExamRepository } from '@/domain/ports/repositories';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

export interface GetExamDetailInput {
  userId: string;
  examId: string;
}

export interface GetExamDetailOutput {
  exam: Exam;
}

/**
 * GetExamDetailUseCase - 시험 상세 정보를 소유권 검증과 함께 조회한다.
 *
 * exam 소유자만 접근할 수 있도록 userId를 비교한다.
 */
export class GetExamDetailUseCase
  implements UseCase<GetExamDetailInput, GetExamDetailOutput>
{
  constructor(
    private readonly examRepo: IExamRepository,
  ) {}

  async execute(input: GetExamDetailInput): Promise<GetExamDetailOutput> {
    const { userId, examId } = input;

    // 1. 시험 조회
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new NotFoundError('Exam', examId);
    }

    // 2. 소유권 검증
    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    return { exam };
  }
}
