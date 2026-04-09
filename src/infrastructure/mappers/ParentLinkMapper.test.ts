import { toDomain, toPersistence } from '@/infrastructure/mappers/ParentLinkMapper';
import type { ParentLinkRow } from '@/infrastructure/mappers/ParentLinkMapper';

describe('ParentLinkMapper', () => {
  const now = new Date().toISOString();
  const linkedAt = new Date().toISOString();

  const fullRow: ParentLinkRow = {
    id: 'pl-1',
    parent_user_id: 'parent-1',
    child_user_id: 'child-1',
    link_code: 'ABC123',
    status: 'active',
    linked_at: linkedAt,
    revoked_at: null,
    created_at: now,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('pl-1');
      expect(result.parentUserId).toBe('parent-1');
      expect(result.childUserId).toBe('child-1');
      expect(result.linkCode).toBe('ABC123');
      expect(result.status).toBe('active');
      expect(result.linkedAt).toBe(linkedAt);
      expect(result.revokedAt).toBeNull();
      expect(result.createdAt).toBe(now);
    });

    it('maps a pending link (parent_user_id: null, link_code set, linked_at: null)', () => {
      const pendingRow: ParentLinkRow = {
        ...fullRow,
        parent_user_id: null,
        link_code: 'ABC123',
        status: 'pending',
        linked_at: null,
      };
      const result = toDomain(pendingRow);

      expect(result.parentUserId).toBeNull();
      expect(result.linkCode).toBe('ABC123');
      expect(result.status).toBe('pending');
      expect(result.linkedAt).toBeNull();
    });

    it('maps an active link (parent_user_id set, link_code: null, linked_at set)', () => {
      const activeRow: ParentLinkRow = {
        ...fullRow,
        parent_user_id: 'p1',
        link_code: null,
        status: 'active',
        linked_at: '2025-01-01T00:00:00.000Z',
      };
      const result = toDomain(activeRow);

      expect(result.parentUserId).toBe('p1');
      expect(result.linkCode).toBeNull();
      expect(result.status).toBe('active');
      expect(result.linkedAt).toBe('2025-01-01T00:00:00.000Z');
    });

    it('maps a revoked link', () => {
      const revokedAt = new Date().toISOString();
      const revokedRow: ParentLinkRow = {
        ...fullRow,
        status: 'revoked',
        revoked_at: revokedAt,
      };
      const result = toDomain(revokedRow);

      expect(result.status).toBe('revoked');
      expect(result.revokedAt).toBe(revokedAt);
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        parentUserId: 'parent-1',
        childUserId: 'child-1',
        linkCode: 'XYZ789',
        status: 'active',
        linkedAt: linkedAt,
        revokedAt: null,
      });

      expect(result.parent_user_id).toBe('parent-1');
      expect(result.child_user_id).toBe('child-1');
      expect(result.link_code).toBe('XYZ789');
      expect(result.status).toBe('active');
      expect(result.linked_at).toBe(linkedAt);
      expect(result.revoked_at).toBeNull();
    });

    it('maps partial update with only status and linkedAt for activation', () => {
      const result = toPersistence({ status: 'active', linkedAt: linkedAt });

      expect(result).toEqual({ status: 'active', linked_at: linkedAt });
    });

    it('preserves null parentUserId', () => {
      const result = toPersistence({ parentUserId: null });

      expect(result).toHaveProperty('parent_user_id');
      expect(result.parent_user_id).toBeNull();
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ status: 'pending' });

      expect(result).toEqual({ status: 'pending' });
      expect(result).not.toHaveProperty('parent_user_id');
      expect(result).not.toHaveProperty('child_user_id');
      expect(result).not.toHaveProperty('link_code');
      expect(result).not.toHaveProperty('linked_at');
      expect(result).not.toHaveProperty('revoked_at');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
