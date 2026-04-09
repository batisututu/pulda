import { toDomain, toPersistence } from '@/infrastructure/mappers/MiniTestAnswerMapper';
import type { MiniTestAnswerRow } from '@/infrastructure/mappers/MiniTestAnswerMapper';

describe('MiniTestAnswerMapper', () => {
  const createdAt = new Date().toISOString();

  // 모든 optional 필드가 채워진 기준 row
  const fullRow: MiniTestAnswerRow = {
    id: 'mta-1',
    test_id: 'mt-1',
    variant_question_id: 'vq-1',
    user_answer: '3',
    is_correct: true,
    time_spent: 42,
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('mta-1');
      expect(result.testId).toBe('mt-1');
      expect(result.variantQuestionId).toBe('vq-1');
      expect(result.userAnswer).toBe('3');
      expect(result.isCorrect).toBe(true);
      expect(result.timeSpent).toBe(42);
      expect(result.createdAt).toBe(createdAt);
    });

    it('preserves null userAnswer for unanswered questions', () => {
      // 미응답 문항은 userAnswer가 null이어야 함
      const result = toDomain({ ...fullRow, user_answer: null });

      expect(result.userAnswer).toBeNull();
    });

    it('preserves null isCorrect when not yet evaluated', () => {
      // 채점 전 상태에서는 isCorrect가 null이어야 함
      const result = toDomain({ ...fullRow, is_correct: null });

      expect(result.isCorrect).toBeNull();
    });

    it('preserves null timeSpent', () => {
      const result = toDomain({ ...fullRow, time_spent: null });

      expect(result.timeSpent).toBeNull();
    });

    it('handles false isCorrect', () => {
      const result = toDomain({ ...fullRow, is_correct: false });

      expect(result.isCorrect).toBe(false);
    });

    it('preserves all nulls for unanswered+unevaluated row', () => {
      const result = toDomain({
        ...fullRow,
        user_answer: null,
        is_correct: null,
        time_spent: null,
      });

      expect(result.userAnswer).toBeNull();
      expect(result.isCorrect).toBeNull();
      expect(result.timeSpent).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        testId: 'mt-1',
        variantQuestionId: 'vq-1',
        userAnswer: '2',
        isCorrect: false,
        timeSpent: 30,
      });

      expect(result.test_id).toBe('mt-1');
      expect(result.variant_question_id).toBe('vq-1');
      expect(result.user_answer).toBe('2');
      expect(result.is_correct).toBe(false);
      expect(result.time_spent).toBe(30);
    });

    it('maps partial update with only isCorrect', () => {
      const result = toPersistence({ isCorrect: true });

      expect(result).toEqual({ is_correct: true });
    });

    it('preserves null values in partial updates', () => {
      // 명시적 null 값이 row에 포함되어야 함
      const result = toPersistence({ userAnswer: null, isCorrect: null, timeSpent: null });

      expect(result.user_answer).toBeNull();
      expect(result.is_correct).toBeNull();
      expect(result.time_spent).toBeNull();
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ testId: 'mt-2' });

      expect(result).not.toHaveProperty('variant_question_id');
      expect(result).not.toHaveProperty('user_answer');
      expect(result).not.toHaveProperty('is_correct');
      expect(result).not.toHaveProperty('time_spent');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
