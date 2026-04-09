import { GetExamDetailUseCase } from '@/usecases/exam/GetExamDetailUseCase';
import { makeExam } from '@/__tests__/factories';
import { mockExamRepository } from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

describe('GetExamDetailUseCase', () => {
  const setup = () => {
    const examRepo = mockExamRepository();
    const useCase = new GetExamDetailUseCase(examRepo);
    return { useCase, examRepo };
  };

  it('should return exam for valid owner', async () => {
    const { useCase, examRepo } = setup();

    const examData = makeExam({ id: 'exam-1', userId: 'u1' });
    examRepo.findById.mockResolvedValue(examData);

    const result = await useCase.execute({ userId: 'u1', examId: 'exam-1' });

    expect(result.exam.id).toBe('exam-1');
    expect(result.exam.userId).toBe('u1');
    expect(examRepo.findById).toHaveBeenCalledWith('exam-1');
  });

  it('should throw NotFoundError when exam not found', async () => {
    const { useCase, examRepo } = setup();
    examRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'u1', examId: 'missing' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when user is not owner', async () => {
    const { useCase, examRepo } = setup();

    const examData = makeExam({ id: 'exam-1', userId: 'owner-id' });
    examRepo.findById.mockResolvedValue(examData);

    await expect(
      useCase.execute({ userId: 'other-user', examId: 'exam-1' }),
    ).rejects.toThrow(ForbiddenError);
  });
});
