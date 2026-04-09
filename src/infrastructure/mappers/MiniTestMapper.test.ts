import { toDomain, toPersistence } from '@/infrastructure/mappers/MiniTestMapper';
import type { MiniTestRow } from '@/infrastructure/mappers/MiniTestMapper';

describe('MiniTestMapper', () => {
  const now = new Date().toISOString();
  const completedAt = new Date().toISOString();

  const fullRow: MiniTestRow = {
    id: 'mt-1',
    user_id: 'user-1',
    variant_ids: ['v-1', 'v-2', 'v-3'],
    score: 85,
    total_points: 100,
    time_spent: 1200,
    completed_at: completedAt,
    created_at: now,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('mt-1');
      expect(result.userId).toBe('user-1');
      expect(result.variantIds).toEqual(['v-1', 'v-2', 'v-3']);
      expect(result.score).toBe(85);
      expect(result.totalPoints).toBe(100);
      expect(result.timeSpent).toBe(1200);
      expect(result.completedAt).toBe(completedAt);
      expect(result.createdAt).toBe(now);
    });

    it('preserves variant_ids array', () => {
      const result = toDomain(fullRow);

      expect(Array.isArray(result.variantIds)).toBe(true);
      expect(result.variantIds).toHaveLength(3);
    });

    it('preserves null fields (score, total_points, time_spent, completed_at)', () => {
      const row: MiniTestRow = {
        ...fullRow,
        score: null,
        total_points: null,
        time_spent: null,
        completed_at: null,
      };
      const result = toDomain(row);

      expect(result.score).toBeNull();
      expect(result.totalPoints).toBeNull();
      expect(result.timeSpent).toBeNull();
      expect(result.completedAt).toBeNull();
    });

    it('maps non-null numeric values correctly', () => {
      const result = toDomain(fullRow);

      expect(typeof result.score).toBe('number');
      expect(typeof result.totalPoints).toBe('number');
      expect(typeof result.timeSpent).toBe('number');
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-1',
        variantIds: ['v-1', 'v-2'],
        score: 90,
        totalPoints: 100,
        timeSpent: 600,
        completedAt: completedAt,
      });

      expect(result.user_id).toBe('user-1');
      expect(result.variant_ids).toEqual(['v-1', 'v-2']);
      expect(result.score).toBe(90);
      expect(result.total_points).toBe(100);
      expect(result.time_spent).toBe(600);
      expect(result.completed_at).toBe(completedAt);
    });

    it('maps partial update with only score and totalPoints', () => {
      const result = toPersistence({ score: 75, totalPoints: 100 });

      expect(result).toEqual({ score: 75, total_points: 100 });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ score: 50 });

      expect(result).toEqual({ score: 50 });
      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('variant_ids');
      expect(result).not.toHaveProperty('total_points');
      expect(result).not.toHaveProperty('time_spent');
      expect(result).not.toHaveProperty('completed_at');
    });

    it('preserves variantIds array as variant_ids', () => {
      const ids = ['v-a', 'v-b', 'v-c', 'v-d'];
      const result = toPersistence({ variantIds: ids });

      expect(result.variant_ids).toEqual(ids);
      expect(Array.isArray(result.variant_ids)).toBe(true);
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
