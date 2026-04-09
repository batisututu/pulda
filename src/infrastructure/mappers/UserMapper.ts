import type { User } from '@/domain/entities';

/**
 * Database row shape for the `users` table (snake_case).
 */
export interface UserRow {
  id: string;
  auth_id: string;
  email: string;
  nickname: string;
  grade: string | null;
  school_type: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Maps a Supabase `users` row to the domain User entity.
 */
export function toDomain(row: UserRow): User {
  return {
    id: row.id,
    authId: row.auth_id,
    email: row.email,
    nickname: row.nickname,
    grade: row.grade,
    schoolType: row.school_type,
    role: row.role as 'student' | 'parent',
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a (partial) domain User entity to a Supabase row for persistence.
 * Only includes defined fields to support partial updates.
 */
export function toPersistence(
  user: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (user.authId !== undefined) row.auth_id = user.authId;
  if (user.email !== undefined) row.email = user.email;
  if (user.nickname !== undefined) row.nickname = user.nickname;
  if (user.grade !== undefined) row.grade = user.grade;
  if (user.schoolType !== undefined) row.school_type = user.schoolType;
  if (user.role !== undefined) row.role = user.role;
  if (user.avatarUrl !== undefined) row.avatar_url = user.avatarUrl;

  return row;
}
