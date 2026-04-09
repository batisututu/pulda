import type { Exam } from '@/domain/entities';
import type { Question } from '@/domain/entities';
import type { User } from '@/domain/entities';
import type { Credit } from '@/domain/entities';
import type { MiniTest } from '@/domain/entities';
import type { MiniTestAnswer } from '@/domain/entities';
import type { VariantQuestion } from '@/domain/entities';
import type { Follow } from '@/domain/entities';
import type { ParentLink } from '@/domain/entities';
import type { Notification } from '@/domain/entities';
import type { SharedItem } from '@/domain/entities';
import type { FeedItem } from '@/domain/entities';
import type { Subscription } from '@/domain/entities';
import type { Blueprint } from '@/domain/entities';
import type { ErrorDiagnosis } from '@/domain/entities';
import type { Feedback } from '@/domain/entities';
import type { ExamStatus } from '@/domain/value-objects';
import type { QuestionType } from '@/domain/value-objects';
import type { SubscriptionPlan } from '@/domain/value-objects';
import type { Difficulty } from '@/domain/value-objects';
import type { ErrorType } from '@/domain/value-objects';
import type { FollowStatus } from '@/domain/value-objects';

export function makeExam(overrides: Partial<Exam> = {}): Exam {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    subject: 'math' as const,
    serviceTier: 'ai_analysis' as const,
    imageUrl: 'https://storage.example.com/exams/sample.jpg',
    ocrResult: null,
    status: 'processing' as ExamStatus,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ...overrides,
  };
}

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: crypto.randomUUID(),
    examId: crypto.randomUUID(),
    subject: 'math' as const,
    number: 1,
    content: 'x^2 + 2x + 1 = 0',
    questionType: 'multiple_choice' as QuestionType,
    options: ['1', '2', '3', '4', '5'],
    answer: '1',
    studentAnswer: '1',
    isCorrect: true,
    points: 4,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    authId: crypto.randomUUID(),
    email: 'student@example.com',
    nickname: 'mathstudent',
    grade: 'high1',
    schoolType: 'high',
    role: 'student',
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeCredit(overrides: Partial<Credit> = {}): Credit {
  const resetAt = new Date();
  resetAt.setMonth(resetAt.getMonth() + 1);

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    plan: 'free' as SubscriptionPlan,
    total: 30,
    used: 0,
    resetAt: resetAt.toISOString(),
    ...overrides,
  };
}

export function makeMiniTest(overrides: Partial<MiniTest> = {}): MiniTest {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    variantIds: [crypto.randomUUID(), crypto.randomUUID()],
    score: null,
    totalPoints: null,
    timeSpent: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeMiniTestAnswer(overrides: Partial<MiniTestAnswer> = {}): MiniTestAnswer {
  return {
    id: crypto.randomUUID(),
    testId: crypto.randomUUID(),
    variantQuestionId: crypto.randomUUID(),
    userAnswer: '3',
    isCorrect: true,
    timeSpent: 45,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeVariantQuestion(overrides: Partial<VariantQuestion> = {}): VariantQuestion {
  return {
    id: crypto.randomUUID(),
    diagnosisId: crypto.randomUUID(),
    content: '2x + 3 = 7',
    questionType: 'short_answer' as QuestionType,
    options: null,
    answer: '2',
    explanation: 'Subtract 3 from both sides: 2x = 4, then divide by 2: x = 2',
    difficulty: 'medium' as Difficulty,
    targetErrorType: 'concept_gap' as ErrorType,
    userId: null,
    topic: null,
    grade: null,
    bloomLevel: null,
    trapPoint: null,
    targetTimeSeconds: null,
    verification: null,
    visualExplanation: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeFollow(overrides: Partial<Follow> = {}): Follow {
  return {
    id: crypto.randomUUID(),
    followerId: crypto.randomUUID(),
    followingId: crypto.randomUUID(),
    status: 'pending' as FollowStatus,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeParentLink(overrides: Partial<ParentLink> = {}): ParentLink {
  return {
    id: crypto.randomUUID(),
    parentUserId: null,
    childUserId: crypto.randomUUID(),
    linkCode: 'AB3K7N',
    status: 'pending',
    linkedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    type: 'follow_request',
    title: 'New follow request',
    body: null,
    isRead: false,
    data: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSharedItem(overrides: Partial<SharedItem> = {}): SharedItem {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    itemType: 'variant_set',
    itemId: crypto.randomUUID(),
    visibility: 'followers_only',
    caption: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    itemType: 'variant_set',
    itemId: crypto.randomUUID(),
    visibility: 'followers_only',
    caption: null,
    createdAt: new Date().toISOString(),
    authorNickname: 'testuser',
    authorAvatarUrl: null,
    ...overrides,
  };
}

export function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    plan: 'standard' as SubscriptionPlan,
    status: 'active',
    portoneSubscriptionId: 'portone-sub-123',
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
    ...overrides,
  };
}

export function makeBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
  return {
    id: crypto.randomUUID(),
    examId: crypto.randomUUID(),
    unitDistribution: { '이차방정식': 0.5, '함수': 0.3, '확률': 0.2 },
    typeDistribution: { multiple_choice: 0.6, short_answer: 0.4 },
    difficultyDistribution: { easy: 0.2, medium: 0.5, hard: 0.3 },
    insights: ['이차방정식 비중이 높습니다.'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeErrorDiagnosis(overrides: Partial<ErrorDiagnosis> = {}): ErrorDiagnosis {
  return {
    id: crypto.randomUUID(),
    questionId: crypto.randomUUID(),
    errorType: 'concept_gap' as ErrorType,
    confidence: 0.85,
    reasoning: '인수분해 개념이 부족하여 완전제곱식을 인식하지 못했습니다.',
    correction: '완전제곱식의 패턴을 학습하세요.',
    stepByStep: '1단계: $x^2 + 2x + 1 = (x+1)^2$\n2단계: $(x+1)^2 = 0$',
    verificationResult: { verified: true, verifierAnswer: '-1', match: true },
    visualExplanation: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makeFeedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    targetType: 'explanation',
    targetId: crypto.randomUUID(),
    rating: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
