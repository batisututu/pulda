import type { UseCase } from '@/shared/types';
import type { MiniTest, MiniTestAnswer, VariantQuestion } from '@/domain/entities';
import type {
  IMiniTestRepository,
  IMiniTestAnswerRepository,
  IVariantRepository,
  INotificationRepository,
  IParentLinkRepository,
} from '@/domain/ports/repositories';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@/shared/errors';
import { isCorrectMC, isCorrectShortAnswer, calculateScore } from '@/domain/rules/scoringRules';

export interface SubmitAnswerItem {
  variantQuestionId: string;
  userAnswer: string;
  timeSpent: number;
}

export interface SubmitAnswersInput {
  userId: string;
  testId: string;
  answers: SubmitAnswerItem[];
  totalTimeSpent: number;
}

export interface SubmitAnswersOutput {
  test: MiniTest;
  answers: MiniTestAnswer[];
  score: number;
  totalPoints: number;
}

/**
 * SubmitAnswersUseCase - Scores and saves answers for a mini test.
 *
 * Verifies ownership and completion status, scores each answer against
 * the variant question's correct answer, saves results, and optionally
 * notifies the parent if linked.
 */
export class SubmitAnswersUseCase implements UseCase<SubmitAnswersInput, SubmitAnswersOutput> {
  constructor(
    private readonly miniTestRepo: IMiniTestRepository,
    private readonly miniTestAnswerRepo: IMiniTestAnswerRepository,
    private readonly variantRepo: IVariantRepository,
    private readonly notificationRepo: INotificationRepository,
    private readonly parentLinkRepo: IParentLinkRepository,
  ) {}

  async execute(input: SubmitAnswersInput): Promise<SubmitAnswersOutput> {
    const { userId, testId, answers, totalTimeSpent } = input;

    // 1. Load test and verify ownership
    const test = await this.miniTestRepo.findById(testId);
    if (!test) {
      throw new NotFoundError('MiniTest', testId);
    }
    if (test.userId !== userId) {
      throw new ForbiddenError('Access denied: not the test owner');
    }

    // 2. Verify not already completed
    if (test.completedAt) {
      throw new ConflictError('이미 제출된 테스트입니다.');
    }

    // 3. Validate that all submitted answers belong to this test
    const testVariantIdSet = new Set(test.variantIds);
    for (const a of answers) {
      if (!testVariantIdSet.has(a.variantQuestionId)) {
        throw new ValidationError('제출한 문제가 이 테스트에 속하지 않습니다');
      }
    }

    // 4. Load variant questions for scoring
    const variants = await this.variantRepo.findByIds(test.variantIds);
    const variantMap = new Map<string, VariantQuestion>();
    for (const v of variants) {
      variantMap.set(v.id, v);
    }

    // 5. Score each answer
    const scoredAnswers: Omit<MiniTestAnswer, 'id' | 'createdAt'>[] = answers.map((a) => {
      const variant = variantMap.get(a.variantQuestionId);
      let isCorrect: boolean | null = null;

      if (variant) {
        if (variant.questionType === 'multiple_choice') {
          isCorrect = isCorrectMC(parseInt(a.userAnswer), parseInt(variant.answer));
        } else {
          isCorrect = isCorrectShortAnswer(a.userAnswer, variant.answer);
        }
      }

      return {
        testId,
        variantQuestionId: a.variantQuestionId,
        userAnswer: a.userAnswer,
        isCorrect,
        timeSpent: a.timeSpent,
      };
    });

    // 6. Save answers
    const savedAnswers = await this.miniTestAnswerRepo.createMany(scoredAnswers);

    // 7. Calculate score
    const scoreResult = calculateScore(savedAnswers);

    // 8. Update test with results
    const updatedTest = await this.miniTestRepo.update(testId, {
      score: scoreResult.score,
      totalPoints: scoreResult.totalPoints,
      timeSpent: totalTimeSpent,
      completedAt: new Date().toISOString(),
    });

    // 9. 부모 알림 전송 (fire-and-forget) — 실패해도 테스트 결과 반환에 영향 없음
    this.notifyParent(userId, updatedTest, scoreResult.score, scoreResult.totalPoints)
      .catch((err: unknown) => {
        if (__DEV__) {
          console.warn('[SubmitAnswers] 부모 알림 전송 실패:',
            err instanceof Error ? err.message : err);
        }
      });

    return {
      test: updatedTest,
      answers: savedAnswers,
      score: scoreResult.score,
      totalPoints: scoreResult.totalPoints,
    };
  }

  private async notifyParent(
    userId: string,
    test: MiniTest,
    score: number,
    totalPoints: number,
  ): Promise<void> {
    const parentLinks = await this.parentLinkRepo.findByChild(userId);
    const activeLinks = parentLinks.filter(
      (l) => l.status === 'active' && l.parentUserId !== null,
    );

    await Promise.allSettled(
      activeLinks.map((link) =>
        this.notificationRepo.create({
          userId: link.parentUserId!,
          type: 'mini_test_completed',
          title: '미니테스트 완료',
          body: `자녀가 미니테스트를 완료했습니다. (${score}/${totalPoints})`,
          isRead: false,
          data: { testId: test.id, score, totalPoints },
        }),
      ),
    );
  }
}
