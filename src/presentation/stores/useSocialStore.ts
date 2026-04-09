import { create } from 'zustand';
import { supabase } from '@/infrastructure/api/supabaseClient';
import {
  createGetFeedUseCase,
  createGetPendingFollowsUseCase,
  createSearchUsersUseCase,
  createFollowUserUseCase,
  createRespondToFollowUseCase,
} from '@/di/container';
import type { FeedItem } from '@/domain/entities';
import type { FollowStatus } from '@/domain/value-objects/FollowStatus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// FeedItem은 domain/entities에서 import — authorNickname, authorAvatarUrl 포함
export type { FeedItem } from '@/domain/entities';

export interface SearchUserItem {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  grade: string | null;
  followStatus: FollowStatus | null;
  followId: string | null;
}

export interface PendingFollow {
  id: string;
  followerId: string;
  followerNickname: string;
  createdAt: string;
}

interface SocialState {
  feed: FeedItem[];
  hasMore: boolean;
  searchResults: SearchUserItem[];
  pendingFollows: PendingFollow[];
  isLoading: boolean;
  isSearching: boolean;
  isLoadingMore: boolean;
  error: string | null;
  page: number;

  fetchFeed: () => Promise<void>;
  loadMore: () => Promise<void>;
  fetchPendingFollows: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  respondToFollow: (followId: string, accept: boolean) => Promise<void>;
  clearSearch: () => void;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useSocialStore = create<SocialState>((set, get) => ({
  feed: [],
  hasMore: true,
  searchResults: [],
  pendingFollows: [],
  isLoading: false,
  isSearching: false,
  isLoadingMore: false,
  error: null,
  page: 1,

  fetchFeed: async () => {
    set({ isLoading: true, error: null, page: 1 });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      // GetFeedUseCase가 users JOIN을 통해 authorNickname을 포함한 FeedItem을 반환
      const useCase = createGetFeedUseCase();
      const result = await useCase.execute({
        userId: session.user.id,
        page: 1,
        limit: PAGE_SIZE,
      });

      set({ feed: result.items, hasMore: result.hasMore, isLoading: false, page: 1 });
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드를 불러올 수 없습니다.';
      set({ error: message, isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoadingMore, isLoading } = get();
    if (!hasMore || isLoadingMore || isLoading) return;

    set({ isLoadingMore: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const nextPage = get().page + 1;
      const useCase = createGetFeedUseCase();
      const result = await useCase.execute({
        userId: session.user.id,
        page: nextPage,
        limit: PAGE_SIZE,
      });

      set((state) => ({
        feed: [...state.feed, ...result.items],
        hasMore: result.hasMore,
        page: nextPage,
        isLoadingMore: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '피드를 불러올 수 없습니다.';
      set({ error: message, isLoadingMore: false });
    }
  },

  fetchPendingFollows: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // GetPendingFollowsUseCase가 follows + users 조회를 캡슐화하여 닉네임을 해소
      const useCase = createGetPendingFollowsUseCase();
      const result = await useCase.execute({ userId: session.user.id });

      set({ pendingFollows: result.pendingFollows });
    } catch {
      // 팔로우 요청 조회 실패는 무시 (메인 피드에 영향 없음)
    }
  },

  searchUsers: async (query: string) => {
    if (query.length < 2) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createSearchUsersUseCase();
      const result = await useCase.execute({
        userId: session.user.id,
        query,
      });

      set({ searchResults: result.users, isSearching: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : '검색에 실패했습니다.';
      set({ error: message, isSearching: false });
    }
  },

  followUser: async (targetUserId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createFollowUserUseCase();
      const result = await useCase.execute({
        followerId: session.user.id,
        followingId: targetUserId,
      });

      // 검색 결과에서 해당 유저의 followStatus 업데이트
      set((state) => ({
        searchResults: state.searchResults.map((u) =>
          u.id === targetUserId
            ? { ...u, followStatus: result.status, followId: result.followId }
            : u,
        ),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '팔로우 요청에 실패했습니다.';
      set({ error: message });
    }
  },

  respondToFollow: async (followId: string, accept: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const useCase = createRespondToFollowUseCase();
      await useCase.execute({
        userId: session.user.id,
        followId,
        action: accept ? 'accept' : 'reject',
      });

      // 목록에서 해당 요청 제거
      set((state) => ({
        pendingFollows: state.pendingFollows.filter((f) => f.id !== followId),
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '팔로우 응답에 실패했습니다.';
      set({ error: message });
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useSocialStore;
