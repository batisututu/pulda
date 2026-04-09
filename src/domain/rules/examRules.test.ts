import { canTransitionStatus, isExpired, getExpiryDate } from '@/domain/rules/examRules';
import { makeExam } from '@/__tests__/factories';

describe('canTransitionStatus', () => {
  it('allows processing → ocr_done', () => {
    expect(canTransitionStatus('processing', 'ocr_done')).toBe(true);
  });

  it('allows processing → error', () => {
    expect(canTransitionStatus('processing', 'error')).toBe(true);
  });

  it('disallows processing → verified (skip)', () => {
    expect(canTransitionStatus('processing', 'verified')).toBe(false);
  });

  it('allows ocr_done → verified', () => {
    expect(canTransitionStatus('ocr_done', 'verified')).toBe(true);
  });

  it('allows verified → analyzed', () => {
    expect(canTransitionStatus('verified', 'analyzed')).toBe(true);
  });

  it('allows analyzed → completed', () => {
    expect(canTransitionStatus('analyzed', 'completed')).toBe(true);
  });

  it('disallows completed → processing (terminal state)', () => {
    expect(canTransitionStatus('completed', 'processing')).toBe(false);
  });

  it('allows error → processing (retry)', () => {
    expect(canTransitionStatus('error', 'processing')).toBe(true);
  });

  it('disallows error → ocr_done', () => {
    expect(canTransitionStatus('error', 'ocr_done')).toBe(false);
  });
});

describe('isExpired', () => {
  it('returns false when expiresAt is in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const exam = makeExam({ expiresAt: future.toISOString() });
    expect(isExpired(exam)).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const exam = makeExam({ expiresAt: past.toISOString() });
    expect(isExpired(exam)).toBe(true);
  });
});

describe('getExpiryDate', () => {
  it('returns a date approximately 7 days from now', () => {
    const before = Date.now();
    const expiryDate = getExpiryDate();
    const after = Date.now();

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const toleranceMs = 5000; // 5 seconds

    expect(expiryDate.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - toleranceMs);
    expect(expiryDate.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + toleranceMs);
  });
});
