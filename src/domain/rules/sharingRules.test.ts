import { isShareable, isOriginalExam } from '@/domain/rules/sharingRules';

describe('isShareable', () => {
  it('returns true for variant_set', () => {
    expect(isShareable('variant_set')).toBe(true);
  });

  it('returns true for error_note', () => {
    expect(isShareable('error_note')).toBe(true);
  });

  it('returns true for mini_test_result', () => {
    expect(isShareable('mini_test_result')).toBe(true);
  });

  it('returns true for blueprint', () => {
    expect(isShareable('blueprint')).toBe(true);
  });

  it('returns false for exam (original content)', () => {
    expect(isShareable('exam')).toBe(false);
  });

  it('returns false for exam_image (original content)', () => {
    expect(isShareable('exam_image')).toBe(false);
  });

  it('returns false for unknown types', () => {
    expect(isShareable('random')).toBe(false);
  });
});

describe('isOriginalExam', () => {
  it('returns true for exam', () => {
    expect(isOriginalExam('exam')).toBe(true);
  });

  it('returns true for exam_image', () => {
    expect(isOriginalExam('exam_image')).toBe(true);
  });

  it('returns false for variant_set', () => {
    expect(isOriginalExam('variant_set')).toBe(false);
  });

  it('returns false for blueprint', () => {
    expect(isOriginalExam('blueprint')).toBe(false);
  });
});
