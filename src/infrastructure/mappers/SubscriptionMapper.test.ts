import { toDomain, toPersistence } from '@/infrastructure/mappers/SubscriptionMapper';
import type { SubscriptionRow } from '@/infrastructure/mappers/SubscriptionMapper';

describe('SubscriptionMapper', () => {
  const startedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();

  // 모든 필드가 채워진 기준 row
  const fullRow: SubscriptionRow = {
    id: 'sub-1',
    user_id: 'user-1',
    plan: 'premium',
    status: 'active',
    portone_subscription_id: 'portone-abc123',
    started_at: startedAt,
    expires_at: expiresAt,
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('sub-1');
      expect(result.userId).toBe('user-1');
      expect(result.plan).toBe('premium');
      expect(result.status).toBe('active');
      expect(result.portoneSubscriptionId).toBe('portone-abc123');
      expect(result.startedAt).toBe(startedAt);
      expect(result.expiresAt).toBe(expiresAt);
      expect(result.createdAt).toBe(createdAt);
    });

    it('casts all SubscriptionPlan values', () => {
      // 모든 구독 플랜 값이 올바르게 캐스팅되어야 함
      const plans = ['free', 'standard', 'premium', 'season_pass', 'parent'] as const;

      for (const plan of plans) {
        const result = toDomain({ ...fullRow, plan });
        expect(result.plan).toBe(plan);
      }
    });

    it('casts all status values', () => {
      const statuses = ['active', 'cancelled', 'expired', 'pending'] as const;

      for (const status of statuses) {
        const result = toDomain({ ...fullRow, status });
        expect(result.status).toBe(status);
      }
    });

    it('preserves null portoneSubscriptionId for free plan', () => {
      // 무료 플랜에는 portone 구독 ID가 없음
      const result = toDomain({ ...fullRow, portone_subscription_id: null });

      expect(result.portoneSubscriptionId).toBeNull();
    });

    it('preserves null expiresAt for non-expiring plans', () => {
      // 만료일이 없는 구독도 허용됨
      const result = toDomain({ ...fullRow, expires_at: null });

      expect(result.expiresAt).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-1',
        plan: 'standard',
        status: 'active',
        portoneSubscriptionId: 'portone-xyz',
        startedAt,
        expiresAt,
      });

      expect(result.user_id).toBe('user-1');
      expect(result.plan).toBe('standard');
      expect(result.status).toBe('active');
      expect(result.portone_subscription_id).toBe('portone-xyz');
      expect(result.started_at).toBe(startedAt);
      expect(result.expires_at).toBe(expiresAt);
    });

    it('maps partial update with only status', () => {
      // 구독 상태 변경 시 status만 업데이트됨
      const result = toPersistence({ status: 'cancelled' });

      expect(result).toEqual({ status: 'cancelled' });
    });

    it('preserves null portoneSubscriptionId in row', () => {
      const result = toPersistence({ portoneSubscriptionId: null });

      expect(result).toHaveProperty('portone_subscription_id', null);
    });

    it('preserves null expiresAt in row', () => {
      const result = toPersistence({ expiresAt: null });

      expect(result).toHaveProperty('expires_at', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ plan: 'free' });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('status');
      expect(result).not.toHaveProperty('portone_subscription_id');
      expect(result).not.toHaveProperty('started_at');
      expect(result).not.toHaveProperty('expires_at');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
