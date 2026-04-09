import {
  normalizeAnswer,
  isCorrectMC,
  isCorrectShortAnswer,
  calculateScore,
  predictScore,
} from '@/domain/rules/scoringRules';
import { makeMiniTestAnswer } from '@/__tests__/factories';

describe('normalizeAnswer', () => {
  it('removes whitespace', () => {
    expect(normalizeAnswer(' 3 x ')).toBe('3x');
  });

  it('normalizes LaTeX fractions', () => {
    expect(normalizeAnswer('\\frac{1}{2}')).toBe('1/2');
  });

  it('converts to lowercase', () => {
    expect(normalizeAnswer('ABC')).toBe('abc');
  });

  it('applies all normalizations together', () => {
    expect(normalizeAnswer(' \\frac{3}{4} X ')).toBe('3/4x');
  });
});

describe('isCorrectMC', () => {
  it('returns true when indices match', () => {
    expect(isCorrectMC(2, 2)).toBe(true);
  });

  it('returns false when indices differ', () => {
    expect(isCorrectMC(1, 3)).toBe(false);
  });
});

describe('isCorrectShortAnswer', () => {
  it('returns true for exact match', () => {
    expect(isCorrectShortAnswer('3', '3')).toBe(true);
  });

  it('returns true when answers match after whitespace normalization', () => {
    expect(isCorrectShortAnswer(' 3 ', '3')).toBe(true);
  });

  it('returns true when fraction notation matches normalized form', () => {
    expect(isCorrectShortAnswer('\\frac{1}{2}', '1/2')).toBe(true);
  });

  it('returns false for different answers', () => {
    expect(isCorrectShortAnswer('abc', 'def')).toBe(false);
  });
});

describe('calculateScore', () => {
  it('scores all correct answers', () => {
    const answers = [
      makeMiniTestAnswer({ isCorrect: true }),
      makeMiniTestAnswer({ isCorrect: true }),
      makeMiniTestAnswer({ isCorrect: true }),
    ];
    expect(calculateScore(answers)).toEqual({
      score: 3,
      totalPoints: 3,
      correctCount: 3,
      totalQuestions: 3,
    });
  });

  it('scores all incorrect answers', () => {
    const answers = [
      makeMiniTestAnswer({ isCorrect: false }),
      makeMiniTestAnswer({ isCorrect: false }),
    ];
    expect(calculateScore(answers)).toEqual({
      score: 0,
      totalPoints: 2,
      correctCount: 0,
      totalQuestions: 2,
    });
  });

  it('scores mixed correct and incorrect answers', () => {
    const answers = [
      makeMiniTestAnswer({ isCorrect: true }),
      makeMiniTestAnswer({ isCorrect: false }),
    ];
    expect(calculateScore(answers)).toEqual({
      score: 1,
      totalPoints: 2,
      correctCount: 1,
      totalQuestions: 2,
    });
  });

  it('returns zeroes for empty array', () => {
    expect(calculateScore([])).toEqual({
      score: 0,
      totalPoints: 0,
      correctCount: 0,
      totalQuestions: 0,
    });
  });
});

describe('predictScore', () => {
  it('returns full range and stable trend when no records are provided', () => {
    const result = predictScore([]);
    expect(result).toEqual({ min: 0, max: 100, trend: 'stable', isPremiumFeature: true });
  });

  it('isPremiumFeature is always true', () => {
    expect(predictScore([]).isPremiumFeature).toBe(true);
    expect(predictScore([{ accuracyRatio: 0.8, errorDistribution: {} }]).isPremiumFeature).toBe(true);
  });

  it('returns a stable trend for a single record', () => {
    const result = predictScore([{ accuracyRatio: 1.0, errorDistribution: {} }]);
    expect(result.trend).toBe('stable');
  });

  it('single record with perfect accuracy yields a high range', () => {
    // 기록 1개 → band=15, penalty=0 → min=clamp(100-15)=85, max=clamp(100+15)=100
    const result = predictScore([{ accuracyRatio: 1.0, errorDistribution: {} }]);
    expect(result.min).toBe(85);
    expect(result.max).toBe(100);
  });

  it('returns improving trend when latest score is significantly higher than previous average', () => {
    const result = predictScore([
      { accuracyRatio: 0.5, errorDistribution: {} },
      { accuracyRatio: 0.8, errorDistribution: {} },
    ]);
    expect(result.trend).toBe('improving');
  });

  it('returns declining trend when latest score is significantly lower than previous average', () => {
    const result = predictScore([
      { accuracyRatio: 0.8, errorDistribution: {} },
      { accuracyRatio: 0.5, errorDistribution: {} },
    ]);
    expect(result.trend).toBe('declining');
  });

  it('returns stable trend when score change is within 5 points', () => {
    // 70% → 72% → 68% — 모두 5점 이하 변동
    const result = predictScore([
      { accuracyRatio: 0.70, errorDistribution: {} },
      { accuracyRatio: 0.72, errorDistribution: {} },
      { accuracyRatio: 0.68, errorDistribution: {} },
    ]);
    expect(result.trend).toBe('stable');
  });

  it('concept_gap errors reduce the predicted max (higher penalty than other types)', () => {
    // concept_gap: 5점/건, 최대 15점 감점. 3건 → 15점 감점.
    const withConceptGap = predictScore([{
      accuracyRatio: 0.8,
      errorDistribution: { concept_gap: 3 },
    }]);
    const withoutErrors = predictScore([{
      accuracyRatio: 0.8,
      errorDistribution: {},
    }]);
    // concept_gap 감점이 적용된 예측이 더 낮아야 한다
    expect(withConceptGap.min).toBeLessThan(withoutErrors.min);
  });

  it('calculation_error has smaller penalty than concept_gap for same count', () => {
    const conceptGapResult = predictScore([{
      accuracyRatio: 0.8,
      errorDistribution: { concept_gap: 2 },
    }]);
    const calcErrorResult = predictScore([{
      accuracyRatio: 0.8,
      errorDistribution: { calculation_error: 2 },
    }]);
    // 개념 부족이 계산 실수보다 감점이 크므로 예측 최솟값이 더 낮아야 한다
    expect(conceptGapResult.min).toBeLessThan(calcErrorResult.min);
  });

  it('predicted min is always >= 0', () => {
    // 0점 정확도 + 최대 오류 → 음수가 나오지 않아야 한다
    const result = predictScore([{
      accuracyRatio: 0.0,
      errorDistribution: { concept_gap: 10, calculation_error: 10, time_pressure: 10 },
    }]);
    expect(result.min).toBeGreaterThanOrEqual(0);
  });

  it('predicted max is always <= 100', () => {
    // 100% 정확도여도 max가 100을 초과하지 않아야 한다
    const result = predictScore([{ accuracyRatio: 1.0, errorDistribution: {} }]);
    expect(result.max).toBeLessThanOrEqual(100);
  });

  it('confidence band narrows with more records (min increases)', () => {
    // 같은 정확도, 기록 1개 vs 4개 → 기록이 많을수록 band가 좁아져 min이 높아진다
    const singleRecord = predictScore([{ accuracyRatio: 0.8, errorDistribution: {} }]);
    const fourRecords = predictScore([
      { accuracyRatio: 0.8, errorDistribution: {} },
      { accuracyRatio: 0.8, errorDistribution: {} },
      { accuracyRatio: 0.8, errorDistribution: {} },
      { accuracyRatio: 0.8, errorDistribution: {} },
    ]);
    // 기록이 많을수록 band가 좁아져 min이 높아져야 한다
    expect(fourRecords.min).toBeGreaterThan(singleRecord.min);
  });

  it('min is always less than or equal to max', () => {
    const cases = [
      [{ accuracyRatio: 0.0, errorDistribution: { concept_gap: 5 } }],
      [{ accuracyRatio: 0.5, errorDistribution: {} }],
      [{ accuracyRatio: 1.0, errorDistribution: {} }],
    ];
    for (const records of cases) {
      const result = predictScore(records);
      expect(result.min).toBeLessThanOrEqual(result.max);
    }
  });
});
