import { create } from 'zustand';
import { supabase } from '@/infrastructure/api/supabaseClient';
import { createGetMiniTestDetailUseCase, createSubmitAnswersUseCase } from '@/di/container';
import type { MiniTest, VariantQuestion } from '@/domain/entities';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MiniTestResult {
  score: number;
  total: number;
  answers: Array<{
    variantQuestionId: string;
    userAnswer: string;
    isCorrect: boolean | null;
  }>;
}

interface MiniTestState {
  currentTest: MiniTest | null;
  questions: VariantQuestion[];
  answers: Record<string, string>; // variantQuestionId -> userAnswer
  currentIndex: number;
  isLoading: boolean;
  result: MiniTestResult | null;
  error: string | null;

  loadTest: (testId: string) => Promise<void>;
  setAnswer: (questionId: string, answer: string) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  // totalTimeSpent: 화면에서 useRef로 측정한 경과 시간(초)을 받아 저장
  submitAnswers: (totalTimeSpent: number) => Promise<void>;
  resetTest: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useMiniTestStore = create<MiniTestState>((set, get) => ({
  currentTest: null,
  questions: [],
  answers: {},
  currentIndex: 0,
  isLoading: false,
  result: null,
  error: null,

  loadTest: async (testId: string) => {
    set({ isLoading: true, error: null, result: null, answers: {}, currentIndex: 0 });
    try {
      const useCase = createGetMiniTestDetailUseCase();
      const { test, questions } = await useCase.execute({ testId });
      set({ currentTest: test, questions, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '미니테스트를 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  setAnswer: (questionId: string, answer: string) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: answer },
    }));
  },

  nextQuestion: () => {
    const { currentIndex, questions } = get();
    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  // totalTimeSpent는 화면(solve screen)의 useRef에서 전달받아 한 번만 기록한다.
  // tick()을 제거하여 초마다 발생하던 전역 리렌더링 스톰을 방지한다.
  submitAnswers: async (totalTimeSpent: number) => {
    const { currentTest, answers } = get();
    if (!currentTest) return;

    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const answerItems = Object.entries(answers).map(([variantQuestionId, userAnswer]) => ({
        variantQuestionId,
        userAnswer,
        timeSpent: 0, // individual time not tracked per question
      }));

      const useCase = createSubmitAnswersUseCase();
      const output = await useCase.execute({
        userId: session.user.id,
        testId: currentTest.id,
        answers: answerItems,
        totalTimeSpent,
      });

      set({
        result: {
          score: output.score,
          total: output.totalPoints,
          answers: output.answers.map((a) => ({
            variantQuestionId: a.variantQuestionId,
            userAnswer: a.userAnswer ?? '',
            isCorrect: a.isCorrect,
          })),
        },
        currentTest: output.test,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '제출에 실패했습니다.';
      set({ error: message, isLoading: false });
    }
  },

  resetTest: () => {
    set({
      currentTest: null,
      questions: [],
      answers: {},
      currentIndex: 0,
      isLoading: false,
      result: null,
      error: null,
    });
  },
}));

export default useMiniTestStore;
