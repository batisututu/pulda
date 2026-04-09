import { create } from 'zustand';
import { supabase } from '@/infrastructure/api/supabaseClient';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  nickname?: string;
  grade?: string | null;
  schoolType?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  initAuthListener: () => () => void;
}

/**
 * users 테이블에서 프로필 정보를 조회한다.
 * 조회 실패시 null 반환 (테이블 미생성, RLS 등).
 */
async function fetchUserProfile(authId: string): Promise<{
  role: string;
  nickname?: string;
  grade?: string | null;
  schoolType?: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role, nickname, grade, school_type')
      .eq('auth_id', authId)
      .single();

    if (error || !data) return null;

    return {
      role: data.role,
      nickname: data.nickname ?? undefined,
      grade: data.grade ?? null,
      schoolType: data.school_type ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Supabase Auth user + users 테이블 프로필을 합쳐 AuthUser를 만든다.
 */
async function buildAuthUser(
  authUser: { id: string; email?: string; user_metadata?: Record<string, unknown> },
): Promise<AuthUser> {
  const profile = await fetchUserProfile(authUser.id);

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    role: profile?.role ?? (authUser.user_metadata?.role as string) ?? 'student',
    nickname: profile?.nickname,
    grade: profile?.grade ?? null,
    schoolType: profile?.schoolType ?? null,
  };
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || '로그인에 실패했습니다.');
      }

      if (!data.user) {
        throw new Error('로그인에 실패했습니다.');
      }

      const user = await buildAuthUser(data.user);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (email: string, password: string, role: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
        },
      });

      if (error) {
        throw new Error(error.message || '회원가입에 실패했습니다.');
      }

      if (!data.user) {
        throw new Error('회원가입에 실패했습니다.');
      }

      const user = await buildAuthUser(data.user);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({ user: null, isLoading: false });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const user = await buildAuthUser(session.user);
        set({ user, isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  /**
   * Auth 상태 변경 리스너를 등록한다.
   * 앱 초기화시 한 번 호출하고, 반환된 unsubscribe 함수를 cleanup에 사용한다.
   */
  initAuthListener: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = await buildAuthUser(session.user);
          set({ user, isLoading: false });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, isLoading: false });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // 토큰 갱신시 user 정보는 유지, 필요시 프로필 재조회
          const user = await buildAuthUser(session.user);
          set({ user, isLoading: false });
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  },
}));

export default useAuthStore;
