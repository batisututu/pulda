# Business Rules

All rules are pure functions in `src/domain/rules/`. No I/O, no framework dependencies.

## examRules.ts

```typescript
import { ExamStatus } from '../value-objects/ExamStatus';
import { Exam } from '../entities/Exam';

const VALID_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  processing: ['ocr_done', 'error'],
  ocr_done: ['verified', 'error'],
  verified: ['analyzed', 'error'],
  analyzed: ['completed', 'error'],
  completed: [],
  error: ['processing'], // retry
};

export function canTransitionStatus(from: ExamStatus, to: ExamStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isExpired(exam: Exam): boolean {
  return new Date() > exam.expiresAt;
}

export function getExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}
```

## creditRules.ts

```typescript
import { Credit } from '../entities/Credit';
import { SubscriptionPlan } from '../value-objects/SubscriptionPlan';

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 30,
  standard: 150,
  premium: 400,
  season_pass: 150,
  parent: 0, // parents don't need credits
};

const COST_PER_QUESTION = 1; // 1 credit per question analyzed

export function hasSufficientCredits(credit: Credit, questionCount: number): boolean {
  const cost = calculateCost(questionCount);
  return (credit.total - credit.used) >= cost;
}

export function calculateCost(questionCount: number): number {
  return questionCount * COST_PER_QUESTION;
}

export function getPlanLimit(plan: SubscriptionPlan): number {
  return PLAN_LIMITS[plan];
}

export function getRemainingCredits(credit: Credit): number {
  return credit.total - credit.used;
}

export function isResetDue(credit: Credit): boolean {
  return new Date() >= credit.resetAt;
}
```

## scoringRules.ts

```typescript
import { MiniTestAnswer } from '../entities/MiniTestAnswer';

export function normalizeAnswer(answer: string): string {
  return answer
    .replace(/\s+/g, '')          // remove whitespace
    .replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '$1/$2') // normalize fractions
    .toLowerCase();
}

export function isCorrectMC(selectedIndex: number, correctIndex: number): boolean {
  return selectedIndex === correctIndex;
}

export function isCorrectShortAnswer(userAnswer: string, correctAnswer: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
}

export interface ScoreResult {
  score: number;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
}

export function calculateScore(answers: MiniTestAnswer[]): ScoreResult {
  const correctCount = answers.filter(a => a.isCorrect).length;
  return {
    score: correctCount,
    totalPoints: answers.length,
    correctCount,
    totalQuestions: answers.length,
  };
}
```

## sharingRules.ts

```typescript
const SHAREABLE_TYPES = ['variant_set', 'error_note', 'mini_test_result', 'blueprint'] as const;

/**
 * Original exam papers are NEVER shareable (copyright protection).
 * Only AI-generated outputs can be shared.
 */
export function isShareable(itemType: string): boolean {
  return (SHAREABLE_TYPES as readonly string[]).includes(itemType);
}

export function isOriginalExam(itemType: string): boolean {
  return itemType === 'exam' || itemType === 'exam_image';
}
```

## parentPrivacyRules.ts

```typescript
/**
 * Parent CAN see: aggregate stats, mini test scores, weakness heatmap, error type distribution
 * Parent CANNOT see: original exam images, individual answers, social activity
 */

export interface ParentVisibleData {
  weeklyStats: { questionsSolved: number; studyTime: number; loginDays: number };
  testScores: { date: string; score: number; total: number }[];
  weaknessHeatmap: { unit: string; accuracy: number; questionCount: number }[];
  errorDistribution: { type: string; count: number }[];
}

export interface FullStudentData {
  exams: unknown[];           // HIDDEN from parent
  individualAnswers: unknown[]; // HIDDEN from parent
  socialActivity: unknown[];   // HIDDEN from parent
  weeklyStats: ParentVisibleData['weeklyStats'];
  testScores: ParentVisibleData['testScores'];
  weaknessHeatmap: ParentVisibleData['weaknessHeatmap'];
  errorDistribution: ParentVisibleData['errorDistribution'];
}

export function filterForParent(data: FullStudentData): ParentVisibleData {
  return {
    weeklyStats: data.weeklyStats,
    testScores: data.testScores,
    weaknessHeatmap: data.weaknessHeatmap,
    errorDistribution: data.errorDistribution,
  };
}
```

## followRules.ts

```typescript
const MAX_FOLLOWING = 200;

export function canFollow(currentFollowingCount: number): boolean {
  return currentFollowingCount < MAX_FOLLOWING;
}

/** All accounts are private by default (follow requires approval) */
export const IS_PRIVATE_BY_DEFAULT = true;

export function canSelfFollow(followerId: string, followingId: string): boolean {
  return followerId !== followingId;
}
```

## errorTypeDetection.ts

```typescript
import { ErrorType } from '../value-objects/ErrorType';

/**
 * Determine confidence based on primary (Claude) and verifier (GPT) answers.
 * Match = high confidence, differ = low confidence.
 */
export function determineConfidence(
  primaryAnswer: string,
  verifierAnswer: string,
  baseConfidence: number
): number {
  const normalized1 = primaryAnswer.replace(/\s+/g, '').toLowerCase();
  const normalized2 = verifierAnswer.replace(/\s+/g, '').toLowerCase();
  const match = normalized1 === normalized2;
  return match ? baseConfidence : Math.min(baseConfidence, 0.5);
}

/** Error type display mapping */
export const ERROR_TYPE_CONFIG: Record<ErrorType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  concept_gap: { label: '개념 부족', icon: 'book-open', color: '#F43F5E', bgColor: '#FFF1F2' },
  calculation_error: { label: '계산 실수', icon: 'pencil', color: '#F59E0B', bgColor: '#FFFBEB' },
  time_pressure: { label: '시간 부족', icon: 'clock', color: '#3B82F6', bgColor: '#EFF6FF' },
};
```

## linkCodeRules.ts

```typescript
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I,l
const CODE_LENGTH = 6;
const CODE_EXPIRY_HOURS = 24;

export function generateLinkCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALLOWED_CHARS[Math.floor(Math.random() * ALLOWED_CHARS.length)];
  }
  return code;
}

export function isCodeExpired(createdAt: Date): boolean {
  const expiryMs = CODE_EXPIRY_HOURS * 60 * 60 * 1000;
  return Date.now() - createdAt.getTime() > expiryMs;
}
```
