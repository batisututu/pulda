import { makeParentLink } from '@/__tests__/factories';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetActiveChildrenExecute = vi.fn();
const mockGetDashboardExecute = vi.fn();
const mockGenerateLinkCodeExecute = vi.fn();
const mockLinkParentExecute = vi.fn();

vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'parent-user-id' } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@/di/container', () => ({
  createGetActiveChildrenUseCase: vi.fn(() => ({
    execute: mockGetActiveChildrenExecute,
  })),
  createGetDashboardUseCase: vi.fn(() => ({
    execute: mockGetDashboardExecute,
  })),
  createGenerateLinkCodeUseCase: vi.fn(() => ({
    execute: mockGenerateLinkCodeExecute,
  })),
  createLinkParentUseCase: vi.fn(() => ({
    execute: mockLinkParentExecute,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useParentStore', () => {
  let useParentStore: typeof import('@/presentation/stores/useParentStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/presentation/stores/useParentStore');
    useParentStore = mod.default;
  });

  describe('fetchChildren', () => {
    it('loads active children via UC', async () => {
      const children = [
        makeParentLink({ id: 'pl-1', childUserId: 'child-1', status: 'active' }),
        makeParentLink({ id: 'pl-2', childUserId: 'child-2', status: 'active' }),
      ];
      mockGetActiveChildrenExecute.mockResolvedValue({ children });

      await useParentStore.getState().fetchChildren();

      const state = useParentStore.getState();
      expect(state.children).toEqual(children);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on failure', async () => {
      mockGetActiveChildrenExecute.mockRejectedValue(new Error('DB error'));

      await useParentStore.getState().fetchChildren();

      const state = useParentStore.getState();
      expect(state.error).toBe('DB error');
      expect(state.isLoading).toBe(false);
    });

    it('shows default error for non-Error throws', async () => {
      mockGetActiveChildrenExecute.mockRejectedValue('unknown');

      await useParentStore.getState().fetchChildren();

      expect(useParentStore.getState().error).toBe('자녀 목록을 불러올 수 없습니다.');
    });
  });

  describe('fetchDashboard', () => {
    it('loads dashboard data via UC', async () => {
      const dashboardResult = {
        childNickname: '수학천재',
        childGrade: 'high1',
        data: {
          weeklyStats: { questionsSolved: 20, studyTime: 3600, loginDays: 5 },
          testScores: [{ date: '2026-01-01', score: 8, total: 10 }],
          weaknessHeatmap: [{ unit: '이차방정식', proportion: 0.5, questionCount: 10 }],
          errorDistribution: [{ type: 'concept_gap', count: 5 }],
        },
      };
      mockGetDashboardExecute.mockResolvedValue(dashboardResult);

      await useParentStore.getState().fetchDashboard('child-1');

      const state = useParentStore.getState();
      expect(state.dashboard).toEqual({
        childNickname: '수학천재',
        childGrade: 'high1',
        data: dashboardResult.data,
      });
      expect(state.isLoading).toBe(false);
    });

    it('clears previous dashboard before loading', async () => {
      useParentStore.setState({
        dashboard: {
          childNickname: 'old',
          childGrade: null,
          data: {
            weeklyStats: { questionsSolved: 0, studyTime: 0, loginDays: 0 },
            testScores: [],
            weaknessHeatmap: [],
            errorDistribution: [],
          },
        },
      });

      mockGetDashboardExecute.mockResolvedValue({
        childNickname: 'new',
        childGrade: 'mid2',
        data: {
          weeklyStats: { questionsSolved: 10, studyTime: 1800, loginDays: 3 },
          testScores: [],
          weaknessHeatmap: [],
          errorDistribution: [],
        },
      });

      // fetchDashboard 호출 시 dashboard가 null로 초기화된다
      const promise = useParentStore.getState().fetchDashboard('child-2');

      // 로딩 중 dashboard는 null이어야 한다
      expect(useParentStore.getState().dashboard).toBeNull();

      await promise;

      expect(useParentStore.getState().dashboard?.childNickname).toBe('new');
    });

    it('handles dashboard error', async () => {
      mockGetDashboardExecute.mockRejectedValue(new Error('Not found'));

      await useParentStore.getState().fetchDashboard('child-x');

      expect(useParentStore.getState().error).toBe('Not found');
      expect(useParentStore.getState().isLoading).toBe(false);
    });
  });

  describe('generateLinkCode', () => {
    it('generates code via UC and stores it', async () => {
      mockGenerateLinkCodeExecute.mockResolvedValue({ linkCode: 'AB3K7N' });

      await useParentStore.getState().generateLinkCode();

      const state = useParentStore.getState();
      expect(state.linkCode).toBe('AB3K7N');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles error during code generation', async () => {
      mockGenerateLinkCodeExecute.mockRejectedValue(new Error('Generation failed'));

      await useParentStore.getState().generateLinkCode();

      expect(useParentStore.getState().error).toBe('Generation failed');
      expect(useParentStore.getState().linkCode).toBeNull();
    });
  });

  describe('linkWithCode', () => {
    it('links parent then refreshes children list', async () => {
      const children = [
        makeParentLink({ id: 'pl-new', childUserId: 'child-linked', status: 'active' }),
      ];
      mockLinkParentExecute.mockResolvedValue(undefined);
      mockGetActiveChildrenExecute.mockResolvedValue({ children });

      await useParentStore.getState().linkWithCode('XY9Z3Q');

      // linkParentUseCase가 코드로 호출되었는지 확인
      expect(mockLinkParentExecute).toHaveBeenCalledWith({
        parentUserId: 'parent-user-id',
        linkCode: 'XY9Z3Q',
      });

      // 연동 후 자녀 목록이 갱신된다
      const state = useParentStore.getState();
      expect(state.children).toEqual(children);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('handles link error', async () => {
      mockLinkParentExecute.mockRejectedValue(new Error('Invalid code'));

      await useParentStore.getState().linkWithCode('BADCODE');

      expect(useParentStore.getState().error).toBe('Invalid code');
      expect(useParentStore.getState().isLoading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      useParentStore.setState({ error: 'some error message' });

      useParentStore.getState().clearError();

      expect(useParentStore.getState().error).toBeNull();
    });
  });
});
