import { toDomain, toPersistence } from '@/infrastructure/mappers/SharedItemMapper';
import type { SharedItemRow } from '@/infrastructure/mappers/SharedItemMapper';

describe('SharedItemMapper', () => {
  const createdAt = new Date().toISOString();

  // 모든 필드가 채워진 기준 row
  const fullRow: SharedItemRow = {
    id: 'si-1',
    user_id: 'user-1',
    item_type: 'variant_set',
    item_id: 'vset-1',
    visibility: 'public',
    caption: '오늘의 풀이 공유합니다!',
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('si-1');
      expect(result.userId).toBe('user-1');
      expect(result.itemType).toBe('variant_set');
      expect(result.itemId).toBe('vset-1');
      expect(result.visibility).toBe('public');
      expect(result.caption).toBe('오늘의 풀이 공유합니다!');
      expect(result.createdAt).toBe(createdAt);
    });

    it('casts all itemType values', () => {
      // 원본 시험지는 절대 공유 불가 — AI 생성 콘텐츠만 공유 가능
      const itemTypes = ['variant_set', 'error_note', 'mini_test_result', 'blueprint'] as const;

      for (const itemType of itemTypes) {
        const result = toDomain({ ...fullRow, item_type: itemType });
        expect(result.itemType).toBe(itemType);
      }
    });

    it('casts all visibility values', () => {
      // 공개 범위 값이 올바르게 캐스팅되어야 함
      const visibilities = ['followers_only', 'public'] as const;

      for (const visibility of visibilities) {
        const result = toDomain({ ...fullRow, visibility });
        expect(result.visibility).toBe(visibility);
      }
    });

    it('preserves null caption', () => {
      // 캡션 없이 공유할 수 있어야 함
      const result = toDomain({ ...fullRow, caption: null });

      expect(result.caption).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-2',
        itemType: 'blueprint',
        itemId: 'bp-1',
        visibility: 'followers_only',
        caption: '시험 분석 결과',
      });

      expect(result.user_id).toBe('user-2');
      expect(result.item_type).toBe('blueprint');
      expect(result.item_id).toBe('bp-1');
      expect(result.visibility).toBe('followers_only');
      expect(result.caption).toBe('시험 분석 결과');
    });

    it('maps partial update with only visibility', () => {
      const result = toPersistence({ visibility: 'public' });

      expect(result).toEqual({ visibility: 'public' });
    });

    it('preserves null caption in row', () => {
      const result = toPersistence({ caption: null });

      expect(result).toHaveProperty('caption', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ itemId: 'mn-1' });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('item_type');
      expect(result).not.toHaveProperty('visibility');
      expect(result).not.toHaveProperty('caption');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
