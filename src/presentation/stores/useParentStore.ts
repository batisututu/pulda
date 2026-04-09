import { create } from 'zustand';
import { supabase } from '@/infrastructure/api/supabaseClient';
import {
  createGetDashboardUseCase,
  createGenerateLinkCodeUseCase,
  createLinkParentUseCase,
  createGetActiveChildrenUseCase,
} from '@/di/container';
import type { ParentLink } from '@/domain/entities';
import type { ParentVisibleData } from '@/domain/rules/parentPrivacyRules';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardData {
  childNickname: string;
  childGrade: string | null;
  data: ParentVisibleData;
}

interface ParentState {
  children: ParentLink[];
  dashboard: DashboardData | null;
  linkCode: string | null;
  isLoading: boolean;
  error: string | null;

  fetchChildren: () => Promise<void>;
  fetchDashboard: (childUserId: string) => Promise<void>;
  generateLinkCode: () => Promise<void>;
  linkWithCode: (code: string) => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useParentStore = create<ParentState>((set) => ({
  children: [],
  dashboard: null,
  linkCode: null,
  isLoading: false,
  error: null,

  fetchChildren: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createGetActiveChildrenUseCase();
      const { children } = await useCase.execute({ parentUserId: session.user.id });
      set({ children, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '자녀 목록을 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  fetchDashboard: async (childUserId: string) => {
    set({ isLoading: true, error: null, dashboard: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createGetDashboardUseCase();
      const result = await useCase.execute({
        parentUserId: session.user.id,
        childUserId,
      });

      set({
        dashboard: {
          childNickname: result.childNickname,
          childGrade: result.childGrade,
          data: result.data,
        },
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '대시보드를 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  generateLinkCode: async () => {
    set({ isLoading: true, error: null, linkCode: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createGenerateLinkCodeUseCase();
      const result = await useCase.execute({ userId: session.user.id });

      set({ linkCode: result.linkCode, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '링크 코드 생성에 실패했습니다.';
      set({ error: message, isLoading: false });
    }
  },

  linkWithCode: async (code: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createLinkParentUseCase();
      await useCase.execute({
        parentUserId: session.user.id,
        linkCode: code,
      });

      // 연동 후 자녀 목록 새로고침
      const childrenUseCase = createGetActiveChildrenUseCase();
      const { children } = await childrenUseCase.execute({ parentUserId: session.user.id });
      set({ children, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '연동에 실패했습니다.';
      set({ error: message, isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useParentStore;
