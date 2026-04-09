/**
 * E2-5. Store Tests (Simplified)
 *
 * Zustand store unit tests:
 * - useAuthStore: initial state + interface shape
 * - useMiniTestStore: initial state, setAnswer, nextQuestion, prevQuestion (pure state changes)
 */
// Mock Supabase client before importing stores
vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

// Mock DI container
vi.mock('@/di/container', () => ({
  createSubmitAnswersUseCase: vi.fn(),
}));

describe('useAuthStore', () => {
  // Dynamic import to ensure mocks are in place
  let useAuthStore: typeof import('@/presentation/stores/useAuthStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module registry so store reinitializes
    vi.resetModules();
    const mod = await import('@/presentation/stores/useAuthStore');
    useAuthStore = mod.default;
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('exposes expected interface methods', () => {
    const state = useAuthStore.getState();

    expect(typeof state.login).toBe('function');
    expect(typeof state.signup).toBe('function');
    expect(typeof state.logout).toBe('function');
    expect(typeof state.checkSession).toBe('function');
    expect(typeof state.initAuthListener).toBe('function');
  });
});

describe('useMiniTestStore', () => {
  let useMiniTestStore: typeof import('@/presentation/stores/useMiniTestStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/presentation/stores/useMiniTestStore');
    useMiniTestStore = mod.default;
  });

  it('has correct initial state', () => {
    const state = useMiniTestStore.getState();

    expect(state.currentTest).toBeNull();
    expect(state.questions).toEqual([]);
    expect(state.answers).toEqual({});
    expect(state.currentIndex).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.result).toBeNull();
    expect(state.error).toBeNull();
  });

  describe('setAnswer', () => {
    it('sets an answer for a given question id', () => {
      useMiniTestStore.getState().setAnswer('q-1', '42');

      expect(useMiniTestStore.getState().answers).toEqual({ 'q-1': '42' });
    });

    it('overwrites an existing answer', () => {
      useMiniTestStore.getState().setAnswer('q-1', '42');
      useMiniTestStore.getState().setAnswer('q-1', '99');

      expect(useMiniTestStore.getState().answers['q-1']).toBe('99');
    });

    it('stores multiple answers independently', () => {
      useMiniTestStore.getState().setAnswer('q-1', '10');
      useMiniTestStore.getState().setAnswer('q-2', '20');

      const { answers } = useMiniTestStore.getState();
      expect(answers['q-1']).toBe('10');
      expect(answers['q-2']).toBe('20');
    });
  });

  describe('nextQuestion / prevQuestion', () => {
    beforeEach(() => {
      // Set up 3 questions to allow navigation
      useMiniTestStore.setState({
        questions: [
          { id: 'v1' } as never,
          { id: 'v2' } as never,
          { id: 'v3' } as never,
        ],
        currentIndex: 0,
      });
    });

    it('advances to the next question', () => {
      useMiniTestStore.getState().nextQuestion();

      expect(useMiniTestStore.getState().currentIndex).toBe(1);
    });

    it('advances multiple times', () => {
      useMiniTestStore.getState().nextQuestion();
      useMiniTestStore.getState().nextQuestion();

      expect(useMiniTestStore.getState().currentIndex).toBe(2);
    });

    it('does not go past the last question', () => {
      useMiniTestStore.getState().nextQuestion();
      useMiniTestStore.getState().nextQuestion();
      useMiniTestStore.getState().nextQuestion(); // at index 2 (last), should not advance

      expect(useMiniTestStore.getState().currentIndex).toBe(2);
    });

    it('goes back to the previous question', () => {
      // Start at index 2
      useMiniTestStore.setState({ currentIndex: 2 });

      useMiniTestStore.getState().prevQuestion();

      expect(useMiniTestStore.getState().currentIndex).toBe(1);
    });

    it('does not go before the first question', () => {
      useMiniTestStore.setState({ currentIndex: 0 });

      useMiniTestStore.getState().prevQuestion();

      expect(useMiniTestStore.getState().currentIndex).toBe(0);
    });
  });

  // tick()은 스토어에서 제거됨 — 타이머는 solve 화면의 useRef로 로컬 관리한다.

  describe('resetTest', () => {
    it('resets all state to initial values', () => {
      // 상태를 더럽힌다
      useMiniTestStore.setState({
        currentIndex: 5,
        answers: { 'q-1': '42' },
        error: 'something broke',
      });

      useMiniTestStore.getState().resetTest();

      const state = useMiniTestStore.getState();
      expect(state.currentTest).toBeNull();
      expect(state.questions).toEqual([]);
      expect(state.answers).toEqual({});
      expect(state.currentIndex).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
