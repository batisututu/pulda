import { MiniTestAnswer } from '../entities/MiniTestAnswer';
import type { QuestionType } from '../value-objects/QuestionType';
import type { ErrorType } from '../value-objects/ErrorType';

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

/**
 * Determine if a student answer is correct for a given question.
 * MC: compare 1-based option index. Short answer: normalized string compare.
 * Essay: returns null (requires manual grading).
 */
export function checkAnswer(
  questionType: QuestionType,
  studentAnswer: string | null,
  correctAnswer: string | null,
): boolean | null {
  if (!studentAnswer || !correctAnswer) return null;

  if (questionType === 'multiple_choice') {
    const studentIdx = parseInt(studentAnswer, 10);
    const correctIdx = parseInt(correctAnswer, 10);
    if (!isNaN(studentIdx) && !isNaN(correctIdx)) {
      return isCorrectMC(studentIdx, correctIdx);
    }
    return normalizeAnswer(studentAnswer) === normalizeAnswer(correctAnswer);
  }

  if (questionType === 'short_answer') {
    return isCorrectShortAnswer(studentAnswer, correctAnswer);
  }

  // essay: cannot auto-grade
  return null;
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

// ---------------------------------------------------------------------------
// Score Prediction (Premium feature)
// ---------------------------------------------------------------------------

/**
 * 최근 테스트 한 회의 데이터.
 * accuracyRatio: 정답 수 / 전체 문제 수 (0.0–1.0)
 * errorDistribution: 오답 유형별 문항 수 (없으면 빈 객체)
 */
export interface RecentTestRecord {
  accuracyRatio: number;
  errorDistribution: Partial<Record<ErrorType, number>>;
}

/**
 * predictScore의 반환 타입.
 * min/max는 100점 기준 예측 점수 범위.
 * isPremiumFeature는 항상 true — Premium 전용 기능임을 명시.
 */
export interface ScorePrediction {
  min: number;
  max: number;
  trend: 'improving' | 'stable' | 'declining';
  isPremiumFeature: true;
}

/**
 * 오답 유형별 감점 가중치.
 * 개념 부족은 가장 심각한 약점 — 최대 감점 폭이 크다.
 * 계산 실수는 중간, 시간 부족은 가장 작다.
 */
const ERROR_PENALTY_PER_COUNT: Record<string, number> = {
  concept_gap: 5,
  calculation_error: 3,
  time_pressure: 2,
  // 국어/영어 오류 유형
  comprehension_error: 5,
  grammar_error: 3,
  vocabulary_gap: 3,
  interpretation_error: 4,
};

/** 유형별 최대 누적 감점 상한 */
const ERROR_PENALTY_CAP: Record<string, number> = {
  concept_gap: 15,
  calculation_error: 9,
  time_pressure: 6,
  comprehension_error: 15,
  grammar_error: 9,
  vocabulary_gap: 9,
  interpretation_error: 12,
};

/** 점수를 0–100 범위로 클램프 */
function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/**
 * 최근 테스트 기록을 기반으로 다음 실제 시험 점수 범위를 예측한다.
 * - Premium 전용 기능이므로 반환값에 isPremiumFeature: true가 항상 포함된다.
 * - 기록이 없으면 넓은 불확실 범위(0–100)를 반환한다.
 * - 기록이 많을수록 신뢰 구간이 좁아진다 (±15 → ±10 → ±7).
 * - 오답 유형별 감점이 예측 최댓값을 낮춘다.
 */
export function predictScore(records: RecentTestRecord[]): ScorePrediction {
  // 기록이 없으면 완전 불확실
  if (records.length === 0) {
    return { min: 0, max: 100, trend: 'stable', isPremiumFeature: true };
  }

  // 최신 기록의 점수를 기준점으로 사용
  const latest = records[records.length - 1];
  const baseScore = latest.accuracyRatio * 100;

  // 추세 계산: 기록이 2개 이상이어야 의미 있음
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (records.length >= 2) {
    // 이전 기록들의 평균과 최신 점수를 비교
    const previousRecords = records.slice(0, -1);
    const previousAvg =
      previousRecords.reduce((sum, r) => sum + r.accuracyRatio * 100, 0) /
      previousRecords.length;
    const delta = baseScore - previousAvg;

    // 5점 이상 차이가 있어야 추세로 인정 (작은 변동은 stable)
    if (delta >= 5) {
      trend = 'improving';
    } else if (delta <= -5) {
      trend = 'declining';
    }
  }

  // 오답 유형별 최대 감점 계산 (예측 최댓값을 낮춘다)
  const errorDist = latest.errorDistribution;
  let totalPenalty = 0;
  for (const [errorType, count] of Object.entries(errorDist)) {
    if (count == null || count <= 0) continue;
    const perCount = ERROR_PENALTY_PER_COUNT[errorType] ?? 2;
    const cap = ERROR_PENALTY_CAP[errorType] ?? 6;
    totalPenalty += Math.min(perCount * count, cap);
  }

  // 기록 수에 따라 신뢰 구간 결정 (기록이 많을수록 좁아짐)
  const band = records.length >= 4 ? 7 : records.length >= 2 ? 10 : 15;

  const predictedMax = baseScore - totalPenalty;
  const min = clampScore(predictedMax - band);
  const max = clampScore(baseScore + band);

  return { min, max, trend, isPremiumFeature: true };
}
