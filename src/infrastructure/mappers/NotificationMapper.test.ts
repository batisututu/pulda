import { toDomain, toPersistence } from '@/infrastructure/mappers/NotificationMapper';
import type { NotificationRow } from '@/infrastructure/mappers/NotificationMapper';

describe('NotificationMapper', () => {
  const createdAt = new Date().toISOString();

  // 모든 optional 필드가 채워진 기준 row
  const fullRow: NotificationRow = {
    id: 'notif-1',
    user_id: 'user-1',
    type: 'analysis_complete',
    title: '분석 완료',
    body: '시험지 분석이 완료되었습니다.',
    is_read: false,
    data: { examId: 'exam-1', questionCount: 30 },
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('notif-1');
      expect(result.userId).toBe('user-1');
      expect(result.type).toBe('analysis_complete');
      expect(result.title).toBe('분석 완료');
      expect(result.body).toBe('시험지 분석이 완료되었습니다.');
      expect(result.isRead).toBe(false);
      expect(result.data).toEqual({ examId: 'exam-1', questionCount: 30 });
      expect(result.createdAt).toBe(createdAt);
    });

    it('preserves null body', () => {
      // 알림 본문이 없는 경우 허용됨
      const result = toDomain({ ...fullRow, body: null });

      expect(result.body).toBeNull();
    });

    it('preserves null data payload', () => {
      // 추가 데이터가 없는 알림도 허용됨
      const result = toDomain({ ...fullRow, data: null });

      expect(result.data).toBeNull();
    });

    it('maps isRead true correctly', () => {
      const result = toDomain({ ...fullRow, is_read: true });

      expect(result.isRead).toBe(true);
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-2',
        type: 'parent_link',
        title: '연동 요청',
        body: '자녀가 연동 코드를 발급했습니다.',
        isRead: false,
        data: { code: 'ABC123' },
      });

      expect(result.user_id).toBe('user-2');
      expect(result.type).toBe('parent_link');
      expect(result.title).toBe('연동 요청');
      expect(result.body).toBe('자녀가 연동 코드를 발급했습니다.');
      expect(result.is_read).toBe(false);
      expect(result.data).toEqual({ code: 'ABC123' });
    });

    it('maps partial update with only isRead', () => {
      // 알림 읽음 처리 시 isRead만 업데이트됨
      const result = toPersistence({ isRead: true });

      expect(result).toEqual({ is_read: true });
    });

    it('preserves null body in row', () => {
      const result = toPersistence({ body: null });

      expect(result).toHaveProperty('body', null);
    });

    it('preserves null data in row', () => {
      const result = toPersistence({ data: null });

      expect(result).toHaveProperty('data', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ type: 'credit_reset' });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('title');
      expect(result).not.toHaveProperty('body');
      expect(result).not.toHaveProperty('is_read');
      expect(result).not.toHaveProperty('data');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
