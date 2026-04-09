import {
  hasSufficientCredits,
  calculateCost,
  getPlanLimit,
  getRemainingCredits,
  isResetDue,
} from '@/domain/rules/creditRules';
import { makeCredit } from '@/__tests__/factories';

describe('hasSufficientCredits', () => {
  it('returns true when remaining credits exceed cost', () => {
    const credit = makeCredit({ total: 30, used: 0 });
    expect(hasSufficientCredits(credit, 5)).toBe(true);
  });

  it('returns false when remaining credits are less than cost', () => {
    const credit = makeCredit({ total: 30, used: 29 });
    expect(hasSufficientCredits(credit, 5)).toBe(false);
  });

  it('returns true at exact boundary (remaining equals cost)', () => {
    const credit = makeCredit({ total: 30, used: 25 });
    expect(hasSufficientCredits(credit, 5)).toBe(true);
  });
});

describe('calculateCost', () => {
  it('returns 0 for 0 questions', () => {
    expect(calculateCost(0)).toBe(0);
  });

  it('returns 1 for 1 question', () => {
    expect(calculateCost(1)).toBe(1);
  });

  it('returns 10 for 10 questions', () => {
    expect(calculateCost(10)).toBe(10);
  });
});

describe('getPlanLimit', () => {
  it('returns 30 for free plan', () => {
    expect(getPlanLimit('free')).toBe(30);
  });

  it('returns 150 for standard plan', () => {
    expect(getPlanLimit('standard')).toBe(150);
  });

  it('returns 400 for premium plan', () => {
    expect(getPlanLimit('premium')).toBe(400);
  });

  it('returns 150 for season_pass plan', () => {
    expect(getPlanLimit('season_pass')).toBe(150);
  });

  it('returns 0 for parent plan', () => {
    expect(getPlanLimit('parent')).toBe(0);
  });
});

describe('getRemainingCredits', () => {
  it('calculates remaining credits correctly', () => {
    const credit = makeCredit({ total: 30, used: 10 });
    expect(getRemainingCredits(credit)).toBe(20);
  });
});

describe('isResetDue', () => {
  it('returns false when resetAt is in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const credit = makeCredit({ resetAt: future.toISOString() });
    expect(isResetDue(credit)).toBe(false);
  });

  it('returns true when resetAt is in the past', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const credit = makeCredit({ resetAt: past.toISOString() });
    expect(isResetDue(credit)).toBe(true);
  });
});
