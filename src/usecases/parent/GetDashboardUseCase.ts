import type { UseCase } from '@/shared/types';
import type { IParentLinkRepository } from '@/domain/ports/repositories';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { IMiniTestRepository } from '@/domain/ports/repositories';
import type { IMiniTestAnswerRepository } from '@/domain/ports/repositories';
import type { IDiagnosisRepository } from '@/domain/ports/repositories';
import type { IBlueprintRepository } from '@/domain/ports/repositories';
import type { IExamRepository } from '@/domain/ports/repositories';
import { ForbiddenError, NotFoundError } from '@/shared/errors';
import { filterForParent, type ParentVisibleData, type FullStudentData } from '@/domain/rules/parentPrivacyRules';

export interface GetDashboardInput {
  parentUserId: string;
  childUserId: string;
}

export interface GetDashboardOutput {
  childNickname: string;
  childGrade: string | null;
  data: ParentVisibleData;
}

export class GetDashboardUseCase implements UseCase<GetDashboardInput, GetDashboardOutput> {
  constructor(
    private readonly parentLinkRepo: IParentLinkRepository,
    private readonly userRepo: IUserRepository,
    private readonly miniTestRepo: IMiniTestRepository,
    private readonly miniTestAnswerRepo: IMiniTestAnswerRepository,
    private readonly diagnosisRepo: IDiagnosisRepository,
    private readonly blueprintRepo: IBlueprintRepository,
    private readonly examRepo: IExamRepository,
  ) {}

  async execute(input: GetDashboardInput): Promise<GetDashboardOutput> {
    const { parentUserId, childUserId } = input;

    // 1. Verify active link between parent and child
    const parentLinks = await this.parentLinkRepo.findByParent(parentUserId);
    const activeLink = parentLinks.find(
      (link) =>
        link.childUserId === childUserId &&
        link.status === 'active' &&
        link.parentUserId !== null,
    );
    if (!activeLink) {
      throw new ForbiddenError('활성 연동이 존재하지 않습니다');
    }

    // 2. Load child user
    const childUser = await this.userRepo.findById(childUserId);
    if (!childUser) {
      throw new NotFoundError('User', childUserId);
    }

    // 3. Aggregate weekly stats: mini tests completed in last 7 days
    const miniTests = await this.miniTestRepo.findByUserId(childUserId);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentTests = miniTests.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= oneWeekAgo,
    );

    let questionsSolved = 0;
    let totalStudyTime = 0;
    const loginDays = new Set<string>();

    // 배치 조회로 N+1 문제 해결
    const recentTestIds = recentTests.map((t) => t.id);
    const allAnswers = await this.miniTestAnswerRepo.findByTestIds(recentTestIds);
    const answersByTestId = new Map<string, number>();
    for (const answer of allAnswers) {
      answersByTestId.set(answer.testId, (answersByTestId.get(answer.testId) ?? 0) + 1);
    }

    for (const test of recentTests) {
      questionsSolved += answersByTestId.get(test.id) ?? 0;
      totalStudyTime += test.timeSpent ?? 0;
      if (test.completedAt) {
        loginDays.add(new Date(test.completedAt).toISOString().slice(0, 10));
      }
    }

    const weeklyStats = {
      questionsSolved,
      studyTime: totalStudyTime,
      loginDays: loginDays.size,
    };

    // 4. Aggregate test scores: completed tests (last 20)
    const completedTests = miniTests
      .filter((t) => t.completedAt && t.score !== null && t.totalPoints !== null)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
      .slice(0, 20);

    const testScores = completedTests.map((t) => ({
      date: t.completedAt!,
      score: t.score!,
      total: t.totalPoints!,
    }));

    // 5. Aggregate weakness heatmap from blueprints' unitDistribution.
    //    This shows question distribution across units, not per-unit accuracy.
    //    Per-unit accuracy is not available from blueprints alone.
    const exams = await this.examRepo.findByUserId(childUserId);
    const examIds = exams.map((e) => e.id);

    // 배치 조회로 N+1 문제 해결
    const [allBlueprints, allDiagnoses] = await Promise.all([
      this.blueprintRepo.findByExamIds(examIds),
      this.diagnosisRepo.findByExamIds(examIds),
    ]);

    const unitProportionMap = new Map<string, { totalProportion: number; examCount: number }>();

    for (const blueprint of allBlueprints) {
      for (const [unit, proportion] of Object.entries(blueprint.unitDistribution)) {
        const existing = unitProportionMap.get(unit) ?? { totalProportion: 0, examCount: 0 };
        existing.totalProportion += proportion;
        existing.examCount += 1;
        unitProportionMap.set(unit, existing);
      }
    }

    const weaknessHeatmap = Array.from(unitProportionMap.entries()).map(
      ([unit, data]) => ({
        unit,
        proportion: data.examCount > 0
          ? Math.round((data.totalProportion / data.examCount) * 100) / 100
          : 0,
        questionCount: data.examCount,
      }),
    );

    // 6. Aggregate error distribution from diagnoses (already batch-loaded)
    const errorCountMap = new Map<string, number>();
    for (const diag of allDiagnoses) {
      const count = errorCountMap.get(diag.errorType) ?? 0;
      errorCountMap.set(diag.errorType, count + 1);
    }

    const errorDistribution = Array.from(errorCountMap.entries()).map(
      ([type, count]) => ({ type, count }),
    );

    // 7. Apply privacy filter
    const fullData: FullStudentData = {
      exams: [],
      individualAnswers: [],
      socialActivity: [],
      weeklyStats,
      testScores,
      weaknessHeatmap,
      errorDistribution,
    };

    const filteredData = filterForParent(fullData);

    return {
      childNickname: childUser.nickname,
      childGrade: childUser.grade,
      data: filteredData,
    };
  }
}
