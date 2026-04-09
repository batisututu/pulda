import { toDomain, toPersistence } from '@/infrastructure/mappers/FollowMapper';
import type { FollowRow } from '@/infrastructure/mappers/FollowMapper';

describe('FollowMapper', () => {
  const now = new Date().toISOString();

  const fullRow: FollowRow = {
    id: 'f-1',
    follower_id: 'user-a',
    following_id: 'user-b',
    status: 'accepted',
    created_at: now,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('f-1');
      expect(result.followerId).toBe('user-a');
      expect(result.followingId).toBe('user-b');
      expect(result.status).toBe('accepted');
      expect(result.createdAt).toBe(now);
    });

    it('casts status "pending" to FollowStatus', () => {
      const row: FollowRow = { ...fullRow, status: 'pending' };
      const result = toDomain(row);
      expect(result.status).toBe('pending');
    });

    it('casts status "accepted" to FollowStatus', () => {
      const row: FollowRow = { ...fullRow, status: 'accepted' };
      const result = toDomain(row);
      expect(result.status).toBe('accepted');
    });

    it('casts status "blocked" to FollowStatus', () => {
      const row: FollowRow = { ...fullRow, status: 'blocked' };
      const result = toDomain(row);
      expect(result.status).toBe('blocked');
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        followerId: 'user-a',
        followingId: 'user-b',
        status: 'accepted',
      });

      expect(result.follower_id).toBe('user-a');
      expect(result.following_id).toBe('user-b');
      expect(result.status).toBe('accepted');
    });

    it('maps partial update with only status', () => {
      const result = toPersistence({ status: 'blocked' });

      expect(result).toEqual({ status: 'blocked' });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ status: 'pending' });

      expect(result).not.toHaveProperty('follower_id');
      expect(result).not.toHaveProperty('following_id');
      expect(Object.keys(result)).toEqual(['status']);
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
