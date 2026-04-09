import { GetDashboardUseCase } from '@/usecases/parent/GetDashboardUseCase';
import {
  makeParentLink,
  makeUser,
  makeMiniTest,
  makeMiniTestAnswer,
  makeExam,
  makeBlueprint,
  makeErrorDiagnosis,
} from '@/__tests__/factories';
import {
  mockParentLinkRepository,
  mockUserRepository,
  mockMiniTestRepository,
  mockMiniTestAnswerRepository,
  mockDiagnosisRepository,
  mockBlueprintRepository,
  mockExamRepository,
} from '@/__tests__/mockBuilders';
import { ForbiddenError, NotFoundError } from '@/shared/errors';

describe('GetDashboardUseCase', () => {
  const setup = () => {
    const parentLinkRepo = mockParentLinkRepository();
    const userRepo = mockUserRepository();
    const miniTestRepo = mockMiniTestRepository();
    const miniTestAnswerRepo = mockMiniTestAnswerRepository();
    const diagnosisRepo = mockDiagnosisRepository();
    const blueprintRepo = mockBlueprintRepository();
    const examRepo = mockExamRepository();
    const useCase = new GetDashboardUseCase(
      parentLinkRepo,
      userRepo,
      miniTestRepo,
      miniTestAnswerRepo,
      diagnosisRepo,
      blueprintRepo,
      examRepo,
    );
    return {
      useCase,
      parentLinkRepo,
      userRepo,
      miniTestRepo,
      miniTestAnswerRepo,
      diagnosisRepo,
      blueprintRepo,
      examRepo,
    };
  };

  it('happy path: active link, child found, returns filtered data', async () => {
    const {
      useCase,
      parentLinkRepo,
      userRepo,
      miniTestRepo,
      miniTestAnswerRepo,
      examRepo,
      blueprintRepo,
      diagnosisRepo,
    } = setup();

    const activeLink = makeParentLink({
      parentUserId: 'parent-1',
      childUserId: 'child-1',
      status: 'active',
    });
    parentLinkRepo.findByParent.mockResolvedValue([activeLink]);

    const child = makeUser({ id: 'child-1', nickname: 'mathkid', grade: 'high1' });
    userRepo.findById.mockResolvedValue(child);

    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const completedTest = makeMiniTest({
      id: 'test-1',
      userId: 'child-1',
      score: 80,
      totalPoints: 100,
      timeSpent: 300,
      completedAt: recentDate,
    });
    miniTestRepo.findByUserId.mockResolvedValue([completedTest]);
    miniTestAnswerRepo.findByTestIds.mockResolvedValue([
      makeMiniTestAnswer({ testId: 'test-1' }),
      makeMiniTestAnswer({ testId: 'test-1' }),
    ]);

    const exam = makeExam({ id: 'exam-1', userId: 'child-1' });
    examRepo.findByUserId.mockResolvedValue([exam]);

    const blueprint = makeBlueprint({
      examId: 'exam-1',
      unitDistribution: { '이차방정식': 0.6, '함수': 0.4 },
    });
    blueprintRepo.findByExamIds.mockResolvedValue([blueprint]);

    const diagnosis = makeErrorDiagnosis({ errorType: 'concept_gap' });
    diagnosisRepo.findByExamIds.mockResolvedValue([diagnosis]);

    const result = await useCase.execute({ parentUserId: 'parent-1', childUserId: 'child-1' });

    expect(result.childNickname).toBe('mathkid');
    expect(result.childGrade).toBe('high1');
    expect(result.data.weeklyStats.questionsSolved).toBe(2);
    expect(result.data.testScores).toHaveLength(1);
    expect(result.data.weaknessHeatmap).toHaveLength(2);
    expect(result.data.errorDistribution).toHaveLength(1);
    // Verify parent-hidden fields are not present
    expect(result.data).not.toHaveProperty('exams');
    expect(result.data).not.toHaveProperty('individualAnswers');
    expect(result.data).not.toHaveProperty('socialActivity');
  });

  it('throws ForbiddenError when no active link', async () => {
    const { useCase, parentLinkRepo } = setup();
    parentLinkRepo.findByParent.mockResolvedValue([]);

    await expect(
      useCase.execute({ parentUserId: 'parent-1', childUserId: 'child-1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when child user not found', async () => {
    const { useCase, parentLinkRepo, userRepo } = setup();

    const activeLink = makeParentLink({
      parentUserId: 'parent-1',
      childUserId: 'child-1',
      status: 'active',
    });
    parentLinkRepo.findByParent.mockResolvedValue([activeLink]);
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ parentUserId: 'parent-1', childUserId: 'child-1' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns empty arrays/zeros when no tests and no exams', async () => {
    const { useCase, parentLinkRepo, userRepo, miniTestRepo, examRepo } = setup();

    const activeLink = makeParentLink({
      parentUserId: 'parent-1',
      childUserId: 'child-1',
      status: 'active',
    });
    parentLinkRepo.findByParent.mockResolvedValue([activeLink]);

    const child = makeUser({ id: 'child-1', nickname: 'newkid', grade: 'mid2' });
    userRepo.findById.mockResolvedValue(child);

    miniTestRepo.findByUserId.mockResolvedValue([]);
    examRepo.findByUserId.mockResolvedValue([]);

    const result = await useCase.execute({ parentUserId: 'parent-1', childUserId: 'child-1' });

    expect(result.data.weeklyStats).toEqual({
      questionsSolved: 0,
      studyTime: 0,
      loginDays: 0,
    });
    expect(result.data.testScores).toEqual([]);
    expect(result.data.weaknessHeatmap).toEqual([]);
    expect(result.data.errorDistribution).toEqual([]);
  });
});
