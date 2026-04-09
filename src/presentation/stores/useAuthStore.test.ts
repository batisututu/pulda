// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFromSelect = vi.fn();

vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: (...args: unknown[]) => mockFromSelect(...args),
        }),
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuthStore', () => {
  let useAuthStore: typeof import('@/presentation/stores/useAuthStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // users 프로필 조회 기본: null (프로필 없음)
    mockFromSelect.mockResolvedValue({ data: null, error: null });

    // onAuthStateChange 기본 반환값
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    const mod = await import('@/presentation/stores/useAuthStore');
    useAuthStore = mod.default;
  });

  describe('login', () => {
    it('calls supabase.auth.signInWithPassword and sets user', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'auth-1', email: 'test@example.com', user_metadata: { role: 'student' } },
          session: {},
        },
        error: null,
      });

      await useAuthStore.getState().login('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.id).toBe('auth-1');
      expect(state.user?.email).toBe('test@example.com');
      expect(state.isLoading).toBe(false);
    });

    it('uses profile data from users table when available', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          user: { id: 'auth-2', email: 'student@test.com', user_metadata: {} },
          session: {},
        },
        error: null,
      });

      // users 테이블에서 프로필 조회 성공
      mockFromSelect.mockResolvedValue({
        data: { role: 'student', nickname: '수학천재', grade: 'high1', school_type: 'high' },
        error: null,
      });

      await useAuthStore.getState().login('student@test.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.user?.nickname).toBe('수학천재');
      expect(state.user?.grade).toBe('high1');
      expect(state.user?.schoolType).toBe('high');
      expect(state.user?.role).toBe('student');
    });

    it('throws and does not set user on auth error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        useAuthStore.getState().login('bad@example.com', 'wrong'),
      ).rejects.toThrow('Invalid login credentials');

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('throws when signIn returns no user', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      await expect(
        useAuthStore.getState().login('test@example.com', 'pass'),
      ).rejects.toThrow('로그인에 실패했습니다.');
    });
  });

  describe('signup', () => {
    it('calls supabase.auth.signUp with role metadata', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'new-auth', email: 'new@example.com', user_metadata: { role: 'student' } },
          session: {},
        },
        error: null,
      });

      await useAuthStore.getState().signup('new@example.com', 'pass123', 'student');

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'pass123',
        options: { data: { role: 'student' } },
      });

      const state = useAuthStore.getState();
      expect(state.user?.id).toBe('new-auth');
      expect(state.isLoading).toBe(false);
    });

    it('throws on signup error', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      });

      await expect(
        useAuthStore.getState().signup('dup@example.com', 'pass', 'student'),
      ).rejects.toThrow('Email already registered');

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('throws when signUp returns no user', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      });

      await expect(
        useAuthStore.getState().signup('test@example.com', 'pass', 'student'),
      ).rejects.toThrow('회원가입에 실패했습니다.');
    });
  });

  describe('logout', () => {
    it('calls supabase.auth.signOut and clears user state', async () => {
      // 먼저 로그인 상태를 설정
      useAuthStore.setState({
        user: { id: 'auth-1', email: 'test@example.com', role: 'student' },
      });

      mockSignOut.mockResolvedValue({ error: null });

      await useAuthStore.getState().logout();

      expect(mockSignOut).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('clears user even when signOut throws', async () => {
      useAuthStore.setState({
        user: { id: 'auth-1', email: 'test@example.com', role: 'student' },
      });

      mockSignOut.mockRejectedValue(new Error('Network error'));

      // try/finally는 에러를 전파하지만 finally에서 user를 null로 설정한다
      await expect(useAuthStore.getState().logout()).rejects.toThrow('Network error');

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('checkSession', () => {
    it('sets user from existing session', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            user: { id: 'session-user', email: 'session@test.com', user_metadata: { role: 'parent' } },
          },
        },
      });

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.user?.id).toBe('session-user');
      expect(state.isLoading).toBe(false);
    });

    it('sets user to null when no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await useAuthStore.getState().checkSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets user to null on checkSession error', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      await useAuthStore.getState().checkSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('initAuthListener', () => {
    it('registers auth state change listener and returns unsubscribe', () => {
      const unsubscribeFn = vi.fn();
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeFn } },
      });

      const cleanup = useAuthStore.getState().initAuthListener();

      expect(mockOnAuthStateChange).toHaveBeenCalled();
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(unsubscribeFn).toHaveBeenCalled();
    });
  });
});
