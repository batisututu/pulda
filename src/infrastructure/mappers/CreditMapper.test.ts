import { toDomain, toPersistence } from '@/infrastructure/mappers/CreditMapper';
import type { CreditRow } from '@/infrastructure/mappers/CreditMapper';

describe('CreditMapper', () => {
  const resetAt = new Date().toISOString();

  const fullRow: CreditRow = {
    id: 'cr-1',
    user_id: 'user-1',
    plan: 'premium',
    total: 300,
    used: 42,
    reset_at: resetAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('cr-1');
      expect(result.userId).toBe('user-1');
      expect(result.plan).toBe('premium');
      expect(result.total).toBe(300);
      expect(result.used).toBe(42);
      expect(result.resetAt).toBe(resetAt);
    });

    it('casts plan "free" to SubscriptionPlan', () => {
      const result = toDomain({ ...fullRow, plan: 'free' });
      expect(result.plan).toBe('free');
    });

    it('casts plan "standard" to SubscriptionPlan', () => {
      const result = toDomain({ ...fullRow, plan: 'standard' });
      expect(result.plan).toBe('standard');
    });

    it('casts plan "premium" to SubscriptionPlan', () => {
      const result = toDomain({ ...fullRow, plan: 'premium' });
      expect(result.plan).toBe('premium');
    });

    it('casts plan "season_pass" to SubscriptionPlan', () => {
      const result = toDomain({ ...fullRow, plan: 'season_pass' });
      expect(result.plan).toBe('season_pass');
    });

    it('casts plan "parent" to SubscriptionPlan', () => {
      const result = toDomain({ ...fullRow, plan: 'parent' });
      expect(result.plan).toBe('parent');
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-1',
        plan: 'standard',
        total: 100,
        used: 10,
        resetAt: resetAt,
      });

      expect(result.user_id).toBe('user-1');
      expect(result.plan).toBe('standard');
      expect(result.total).toBe(100);
      expect(result.used).toBe(10);
      expect(result.reset_at).toBe(resetAt);
    });

    it('maps partial update with only used', () => {
      const result = toPersistence({ used: 15 });

      expect(result).toEqual({ used: 15 });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ used: 5 });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('plan');
      expect(result).not.toHaveProperty('total');
      expect(result).not.toHaveProperty('reset_at');
      expect(Object.keys(result)).toEqual(['used']);
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
