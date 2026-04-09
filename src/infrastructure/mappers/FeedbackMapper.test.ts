import { toDomain, toPersistence } from '@/infrastructure/mappers/FeedbackMapper';
import type { FeedbackRow } from '@/infrastructure/mappers/FeedbackMapper';

describe('FeedbackMapper', () => {
  const createdAt = new Date().toISOString();

  // 모든 필드가 채워진 기준 row
  const fullRow: FeedbackRow = {
    id: 'fb-1',
    user_id: 'user-1',
    target_type: 'variant',
    target_id: 'variant-1',
    rating: 1,
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('fb-1');
      expect(result.userId).toBe('user-1');
      expect(result.targetType).toBe('variant');
      expect(result.targetId).toBe('variant-1');
      expect(result.rating).toBe(1);
      expect(result.createdAt).toBe(createdAt);
    });

    it('casts all targetType values', () => {
      // 모든 피드백 대상 유형이 올바르게 캐스팅되어야 함
      const targetTypes = ['explanation', 'variant', 'blueprint'] as const;

      for (const targetType of targetTypes) {
        const result = toDomain({ ...fullRow, target_type: targetType });
        expect(result.targetType).toBe(targetType);
      }
    });

    it('casts thumbs-down rating (-1)', () => {
      // 비추천(-1)이 올바르게 캐스팅되어야 함
      const result = toDomain({ ...fullRow, rating: -1 });

      expect(result.rating).toBe(-1);
    });

    it('casts thumbs-up rating (1)', () => {
      const result = toDomain({ ...fullRow, rating: 1 });

      expect(result.rating).toBe(1);
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-1',
        targetType: 'explanation',
        targetId: 'expl-1',
        rating: -1,
      });

      expect(result.user_id).toBe('user-1');
      expect(result.target_type).toBe('explanation');
      expect(result.target_id).toBe('expl-1');
      expect(result.rating).toBe(-1);
    });

    it('maps partial update with only rating', () => {
      const result = toPersistence({ rating: 1 });

      expect(result).toEqual({ rating: 1 });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ targetId: 'bp-1' });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('target_type');
      expect(result).not.toHaveProperty('rating');
      expect(Object.keys(result)).toEqual(['target_id']);
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
