import { toDomain, toPersistence } from '@/infrastructure/mappers/UserMapper';
import type { UserRow } from '@/infrastructure/mappers/UserMapper';

describe('UserMapper', () => {
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();

  // 모든 optional 필드가 채워진 기준 row (학생)
  const fullRow: UserRow = {
    id: 'user-1',
    auth_id: 'auth-abc123',
    email: 'student@example.com',
    nickname: '수학왕',
    grade: 'grade_10',
    school_type: 'middle',
    role: 'student',
    avatar_url: 'https://storage.example.com/avatars/user-1.jpg',
    created_at: createdAt,
    updated_at: updatedAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('user-1');
      expect(result.authId).toBe('auth-abc123');
      expect(result.email).toBe('student@example.com');
      expect(result.nickname).toBe('수학왕');
      expect(result.grade).toBe('grade_10');
      expect(result.schoolType).toBe('middle');
      expect(result.role).toBe('student');
      expect(result.avatarUrl).toBe('https://storage.example.com/avatars/user-1.jpg');
      expect(result.createdAt).toBe(createdAt);
      expect(result.updatedAt).toBe(updatedAt);
    });

    it('casts role "student"', () => {
      const result = toDomain({ ...fullRow, role: 'student' });

      expect(result.role).toBe('student');
    });

    it('casts role "parent"', () => {
      // 부모 계정은 크레딧 없이 자녀 진도를 모니터링함
      const result = toDomain({ ...fullRow, role: 'parent' });

      expect(result.role).toBe('parent');
    });

    it('preserves null grade', () => {
      // 학년 정보를 아직 입력하지 않은 사용자 허용
      const result = toDomain({ ...fullRow, grade: null });

      expect(result.grade).toBeNull();
    });

    it('preserves null schoolType', () => {
      const result = toDomain({ ...fullRow, school_type: null });

      expect(result.schoolType).toBeNull();
    });

    it('preserves null avatarUrl', () => {
      // 프로필 사진이 없는 사용자 허용
      const result = toDomain({ ...fullRow, avatar_url: null });

      expect(result.avatarUrl).toBeNull();
    });

    it('handles parent user with all optional fields null', () => {
      // 부모 계정은 학교/학년 정보가 없을 수 있음
      const result = toDomain({
        ...fullRow,
        role: 'parent',
        grade: null,
        school_type: null,
        avatar_url: null,
      });

      expect(result.role).toBe('parent');
      expect(result.grade).toBeNull();
      expect(result.schoolType).toBeNull();
      expect(result.avatarUrl).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        authId: 'auth-xyz',
        email: 'parent@example.com',
        nickname: '학부모',
        grade: null,
        schoolType: null,
        role: 'parent',
        avatarUrl: null,
      });

      expect(result.auth_id).toBe('auth-xyz');
      expect(result.email).toBe('parent@example.com');
      expect(result.nickname).toBe('학부모');
      expect(result.grade).toBeNull();
      expect(result.school_type).toBeNull();
      expect(result.role).toBe('parent');
      expect(result.avatar_url).toBeNull();
    });

    it('maps partial update with only nickname', () => {
      // 프로필 닉네임 변경 시 nickname만 업데이트됨
      const result = toPersistence({ nickname: '국어왕' });

      expect(result).toEqual({ nickname: '국어왕' });
    });

    it('maps partial update with only avatarUrl', () => {
      const result = toPersistence({ avatarUrl: 'https://storage.example.com/avatars/new.jpg' });

      expect(result).toEqual({ avatar_url: 'https://storage.example.com/avatars/new.jpg' });
    });

    it('preserves null avatarUrl in row', () => {
      // 프로필 사진 삭제 시 null로 업데이트됨
      const result = toPersistence({ avatarUrl: null });

      expect(result).toHaveProperty('avatar_url', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ email: 'new@example.com' });

      expect(result).not.toHaveProperty('auth_id');
      expect(result).not.toHaveProperty('nickname');
      expect(result).not.toHaveProperty('grade');
      expect(result).not.toHaveProperty('school_type');
      expect(result).not.toHaveProperty('role');
      expect(result).not.toHaveProperty('avatar_url');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
