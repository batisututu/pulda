/**
 * Application user profile (student or parent).
 * Linked to Supabase Auth via authId.
 */
export interface User {
  id: string;
  authId: string;
  email: string;
  nickname: string;
  grade: string | null;           // 'mid1'~'mid3', 'high1'~'high3'
  schoolType: string | null;      // 'middle' | 'high'
  role: 'student' | 'parent';
  avatarUrl: string | null;
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}
