import { makeMiniTest, makeVariantQuestion } from '@/__tests__/factories';

// ---------------------------------------------------------------------------
// Mocks — 스토어 import 전에 선언해야 한다
// ---------------------------------------------------------------------------

const mockGetMiniTestDetailExecute = vi.fn();
const mockSubmitAnswersExecute = vi.fn();

vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@/di/container', () => ({
  createGetMiniTestDetailUseCase: vi.fn(() => ({
    execute: mockGetMiniTestDetailExecute,
  })),
  createSubmitAnswersUseCase: vi.fn(() => ({
    execute: mockSubmitAnswersExecute,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMiniTestStore', () => {
  let useMiniTestStore: typeof import('@/presentation/stores/useMiniTestStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/presentation/stores/useMiniTestStore');
    useMiniTestStore = mod.default;
  });

  describe('loadTest', () => {
    it('sets loading, calls UC, updates state with test + questions', async () => {
      const testEntity = makeMiniTest({ id: 'mt-1', variantIds: ['v1', 'v2'] });
      const questions = [
        makeVariantQuestion({ id: 'v1' }),
        makeVariantQuestion({ id: 'v2' }),
      ];

      mockGetMiniTestDetailExecute.mockResolvedValue({
        test: testEntity,
        questions,
      });

      const loadPromise = useMiniTestStore.getState().loadTest('mt-1');

      // 호출 직후 isLoading이 true여야 한다
      expect(useMiniTestStore.getState().isLoading).toBe(true);

      await loadPromise;

      const state = useMiniTestStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.currentTest).toEqual(testEntity);
      expect(state.questions).toEqual(questions);
      expect(state.error).toBeNull();
      expect(state.answers).toEqual({});
      expect(state.currentIndex).toBe(0);
    });

    it('handles error and sets error message', async () => {
      mockGetMiniTestDetailExecute.mockRejectedValue(new Error('DB connection failed'));

      await useMiniTestStore.getState().loadTest('bad-id');

      const state = useMiniTestStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('DB connection failed');
      expect(state.currentTest).toBeNull();
    });

    it('shows default error message for non-Error throws', async () => {
      mockGetMiniTestDetailExecute.mockRejectedValue('unknown error');

      await useMiniTestStore.getState().loadTest('bad-id');

      expect(useMiniTestStore.getState().error).toBe('미니테스트를 불러올 수 없습니다.');
    });

    it('resets answers and index when loading a new test', async () => {
      // 이전 상태를 설정한다
      useMiniTestStore.setState({
        answers: { 'old-q': '42' },
        currentIndex: 3,
        result: { score: 5, total: 10, answers: [] },
      });

      mockGetMiniTestDetailExecute.mockResolvedValue({
        test: makeMiniTest({ id: 'mt-new' }),
        questions: [],
      });

      await useMiniTestStore.getState().loadTest('mt-new');

      const state = useMiniTestStore.getState();
      expect(state.answers).toEqual({});
      expect(state.currentIndex).toBe(0);
      expect(state.result).toBeNull();
    });
  });

  describe('setAnswer', () => {
    it('updates answers record for a given question id', () => {
      useMiniTestStore.getState().setAnswer('q-1', '42');

      expect(useMiniTestStore.getState().answers).toEqual({ 'q-1': '42' });
    });

    it('overwrites an existing answer', () => {
      useMiniTestStore.getState().setAnswer('q-1', '10');
      useMiniTestStore.getState().setAnswer('q-1', '99');

      expect(useMiniTestStore.getState().answers['q-1']).toBe('99');
    });
  });

  describe('nextQuestion / prevQuestion', () => {
    beforeEach(() => {
      useMiniTestStore.setState({
        questions: [
          makeVariantQuestion({ id: 'v1' }),
          makeVariantQuestion({ id: 'v2' }),
          makeVariantQuestion({ id: 'v3' }),
        ],
        currentIndex: 0,
      });
    });

    it('advances to the next question', () => {
      useMiniTestStore.getState().nextQuestion();
      expect(useMiniTestStore.getState().currentIndex).toBe(1);
    });

    it('does not advance past the last question', () => {
      useMiniTestStore.setState({ currentIndex: 2 });
      useMiniTestStore.getState().nextQuestion();
      expect(useMiniTestStore.getState().currentIndex).toBe(2);
    });

    it('goes back to the previous question', () => {
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

  describe('submitAnswers', () => {
    it('submits answers and updates result', async () => {
      const testEntity = makeMiniTest({ id: 'mt-1' });
      useMiniTestStore.setState({
        currentTest: testEntity,
        answers: { 'v1': '3', 'v2': '5' },
      });

      const ucOutput = {
        test: { ...testEntity, score: 8, totalPoints: 10, completedAt: '2026-01-01T00:00:00Z' },
        answers: [
          { variantQuestionId: 'v1', userAnswer: '3', isCorrect: true },
          { variantQuestionId: 'v2', userAnswer: '5', isCorrect: false },
        ],
        score: 8,
        totalPoints: 10,
      };
      mockSubmitAnswersExecute.mockResolvedValue(ucOutput);

      await useMiniTestStore.getState().submitAnswers(120);

      const state = useMiniTestStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.result).toEqual({
        score: 8,
        total: 10,
        answers: [
          { variantQuestionId: 'v1', userAnswer: '3', isCorrect: true },
          { variantQuestionId: 'v2', userAnswer: '5', isCorrect: false },
        ],
      });
    });

    it('does nothing if currentTest is null', async () => {
      useMiniTestStore.setState({ currentTest: null });

      await useMiniTestStore.getState().submitAnswers(60);

      expect(mockSubmitAnswersExecute).not.toHaveBeenCalled();
    });

    it('handles submit error', async () => {
      useMiniTestStore.setState({ currentTest: makeMiniTest({ id: 'mt-err' }) });
      mockSubmitAnswersExecute.mockRejectedValue(new Error('Network error'));

      await useMiniTestStore.getState().submitAnswers(60);

      const state = useMiniTestStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });
  });

  describe('resetTest', () => {
    it('clears all state to initial values', () => {
      useMiniTestStore.setState({
        currentTest: makeMiniTest(),
        questions: [makeVariantQuestion()],
        answers: { 'q-1': '42' },
        currentIndex: 5,
        isLoading: true,
        result: { score: 5, total: 10, answers: [] },
        error: 'some error',
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
