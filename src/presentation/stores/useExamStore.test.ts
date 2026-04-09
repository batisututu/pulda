// ---------------------------------------------------------------------------
// Mocks — 스토어 import 전에 선언
// ---------------------------------------------------------------------------

const mockSupabaseFrom = vi.fn();
const mockGetSession = vi.fn();
const mockUploadExamExecute = vi.fn();

vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: () => mockFromChain(),
  },
}));

vi.mock('@/di/container', () => ({
  createUploadExamUseCase: vi.fn(() => ({
    execute: mockUploadExamExecute,
  })),
  createGetDiagnosisUseCase: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

vi.mock('@/infrastructure/api/edgeFunctions', () => ({
  invokeRunOcr: vi.fn().mockResolvedValue({ examId: 'e1', status: 'ok', questionsCount: 5 }),
}));

vi.mock('@/domain/rules/subjectRules', () => ({
  getServiceTier: vi.fn().mockReturnValue('ai_analysis'),
}));

// supabase.from() 체인 헬퍼
function mockFromChain() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue(mockSupabaseFrom()),
        single: vi.fn().mockReturnValue(mockSupabaseFrom()),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockReturnValue(mockSupabaseFrom()),
        }),
        in: vi.fn().mockReturnValue(mockSupabaseFrom()),
        maybeSingle: vi.fn().mockReturnValue(mockSupabaseFrom()),
      }),
      in: vi.fn().mockReturnValue(mockSupabaseFrom()),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useExamStore', () => {
  let useExamStore: typeof import('@/presentation/stores/useExamStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // 기본 세션: 로그인 상태
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'test-user-id' } } },
    });

    const mod = await import('@/presentation/stores/useExamStore');
    useExamStore = mod.default;
  });

  it('has correct initial state', () => {
    const state = useExamStore.getState();

    expect(state.exams).toEqual([]);
    expect(state.currentExam).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  describe('fetchExams', () => {
    it('loads exams list from supabase', async () => {
      const mockRows = [
        {
          id: 'e1',
          user_id: 'test-user-id',
          subject: 'math',
          service_tier: 'ai_analysis',
          image_url: 'https://example.com/img.jpg',
          ocr_result: null,
          status: 'completed',
          created_at: '2026-01-01T00:00:00Z',
          expires_at: '2026-01-08T00:00:00Z',
        },
      ];

      mockSupabaseFrom.mockResolvedValue({ data: mockRows, error: null });

      await useExamStore.getState().fetchExams();

      const state = useExamStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.exams).toHaveLength(1);
      expect(state.exams[0].id).toBe('e1');
      expect(state.error).toBeNull();
    });

    it('sets error when supabase returns error', async () => {
      mockSupabaseFrom.mockResolvedValue({
        data: null,
        error: { message: 'Table not found' },
      });

      await useExamStore.getState().fetchExams();

      const state = useExamStore.getState();
      expect(state.error).toBe('Table not found');
      expect(state.isLoading).toBe(false);
    });

    it('sets error when session is missing', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await useExamStore.getState().fetchExams();

      expect(useExamStore.getState().error).toBe('로그인이 필요합니다.');
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useExamStore.setState({ error: 'previous error' });

      useExamStore.getState().clearError();

      expect(useExamStore.getState().error).toBeNull();
    });
  });

  describe('loading flags', () => {
    it('sets isLoading to true during fetchExams', async () => {
      // 아직 resolve되지 않는 promise로 로딩 상태를 확인
      let resolvePromise!: (value: unknown) => void;
      mockSupabaseFrom.mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve; }),
      );

      const fetchPromise = useExamStore.getState().fetchExams();

      expect(useExamStore.getState().isLoading).toBe(true);
      expect(useExamStore.getState().error).toBeNull();

      resolvePromise({ data: [], error: null });
      await fetchPromise;

      expect(useExamStore.getState().isLoading).toBe(false);
    });
  });
});
