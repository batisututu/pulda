import { makeFeedItem } from '@/__tests__/factories';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetFeedExecute = vi.fn();
const mockGetPendingFollowsExecute = vi.fn();
const mockSearchUsersExecute = vi.fn();
const mockFollowUserExecute = vi.fn();
const mockRespondToFollowExecute = vi.fn();

vi.mock('@/infrastructure/api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'social-user-id' } } },
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

vi.mock('@/di/container', () => ({
  createGetFeedUseCase: vi.fn(() => ({
    execute: mockGetFeedExecute,
  })),
  createGetPendingFollowsUseCase: vi.fn(() => ({
    execute: mockGetPendingFollowsExecute,
  })),
  createSearchUsersUseCase: vi.fn(() => ({
    execute: mockSearchUsersExecute,
  })),
  createFollowUserUseCase: vi.fn(() => ({
    execute: mockFollowUserExecute,
  })),
  createRespondToFollowUseCase: vi.fn(() => ({
    execute: mockRespondToFollowExecute,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSocialStore', () => {
  let useSocialStore: typeof import('@/presentation/stores/useSocialStore').default;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/presentation/stores/useSocialStore');
    useSocialStore = mod.default;
  });

  it('has correct initial state', () => {
    const state = useSocialStore.getState();

    expect(state.feed).toEqual([]);
    expect(state.hasMore).toBe(true);
    expect(state.searchResults).toEqual([]);
    expect(state.pendingFollows).toEqual([]);
    expect(state.isLoading).toBe(false);
    expect(state.isSearching).toBe(false);
    expect(state.isLoadingMore).toBe(false);
    expect(state.error).toBeNull();
    expect(state.page).toBe(1);
  });

  describe('fetchFeed', () => {
    it('loads feed items via GetFeedUseCase', async () => {
      const items = [
        makeFeedItem({ id: 'fi-1' }),
        makeFeedItem({ id: 'fi-2' }),
      ];
      mockGetFeedExecute.mockResolvedValue({ items, hasMore: true });

      await useSocialStore.getState().fetchFeed();

      const state = useSocialStore.getState();
      expect(state.feed).toEqual(items);
      expect(state.hasMore).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.page).toBe(1);
    });

    it('handles feed error', async () => {
      mockGetFeedExecute.mockRejectedValue(new Error('Feed failed'));

      await useSocialStore.getState().fetchFeed();

      expect(useSocialStore.getState().error).toBe('Feed failed');
      expect(useSocialStore.getState().isLoading).toBe(false);
    });
  });

  describe('loadMore', () => {
    it('appends next page items to feed', async () => {
      const firstPage = [makeFeedItem({ id: 'fi-1' })];
      const secondPage = [makeFeedItem({ id: 'fi-2' })];

      // 첫 번째 페이지 로드
      mockGetFeedExecute.mockResolvedValueOnce({ items: firstPage, hasMore: true });
      await useSocialStore.getState().fetchFeed();

      // 두 번째 페이지 로드
      mockGetFeedExecute.mockResolvedValueOnce({ items: secondPage, hasMore: false });
      await useSocialStore.getState().loadMore();

      const state = useSocialStore.getState();
      expect(state.feed).toHaveLength(2);
      expect(state.feed[0].id).toBe('fi-1');
      expect(state.feed[1].id).toBe('fi-2');
      expect(state.hasMore).toBe(false);
      expect(state.page).toBe(2);
    });

    it('does not load more when hasMore is false', async () => {
      useSocialStore.setState({ hasMore: false });

      await useSocialStore.getState().loadMore();

      expect(mockGetFeedExecute).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('calls SearchUsersUseCase with query', async () => {
      const users = [
        { id: 'u1', nickname: 'alice', avatarUrl: null, grade: 'high1', followStatus: null, followId: null },
      ];
      mockSearchUsersExecute.mockResolvedValue({ users });

      await useSocialStore.getState().searchUsers('alice');

      const state = useSocialStore.getState();
      expect(state.searchResults).toEqual(users);
      expect(state.isSearching).toBe(false);
    });

    it('clears results and skips UC for short queries', async () => {
      await useSocialStore.getState().searchUsers('a');

      expect(mockSearchUsersExecute).not.toHaveBeenCalled();
      expect(useSocialStore.getState().searchResults).toEqual([]);
    });

    it('handles search error', async () => {
      mockSearchUsersExecute.mockRejectedValue(new Error('Search failed'));

      await useSocialStore.getState().searchUsers('test query');

      expect(useSocialStore.getState().error).toBe('Search failed');
      expect(useSocialStore.getState().isSearching).toBe(false);
    });
  });

  describe('followUser', () => {
    it('calls FollowUserUseCase and updates search results', async () => {
      useSocialStore.setState({
        searchResults: [
          { id: 'target-1', nickname: 'Bob', avatarUrl: null, grade: null, followStatus: null, followId: null },
        ],
      });

      mockFollowUserExecute.mockResolvedValue({ followId: 'f-new', status: 'pending' });

      await useSocialStore.getState().followUser('target-1');

      const state = useSocialStore.getState();
      expect(state.searchResults[0].followStatus).toBe('pending');
      expect(state.searchResults[0].followId).toBe('f-new');
    });

    it('handles follow error', async () => {
      mockFollowUserExecute.mockRejectedValue(new Error('Already following'));

      await useSocialStore.getState().followUser('target-1');

      expect(useSocialStore.getState().error).toBe('Already following');
    });
  });

  describe('respondToFollow', () => {
    it('calls RespondToFollowUseCase and removes from pending list', async () => {
      useSocialStore.setState({
        pendingFollows: [
          { id: 'f-1', followerId: 'u-a', followerNickname: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'f-2', followerId: 'u-b', followerNickname: 'Bob', createdAt: '2026-01-02T00:00:00Z' },
        ],
      });

      mockRespondToFollowExecute.mockResolvedValue(undefined);

      await useSocialStore.getState().respondToFollow('f-1', true);

      // accept 요청이 UC에 전달된다
      expect(mockRespondToFollowExecute).toHaveBeenCalledWith({
        userId: 'social-user-id',
        followId: 'f-1',
        action: 'accept',
      });

      // 목록에서 해당 요청이 제거된다
      const state = useSocialStore.getState();
      expect(state.pendingFollows).toHaveLength(1);
      expect(state.pendingFollows[0].id).toBe('f-2');
    });

    it('sends reject action when accept is false', async () => {
      useSocialStore.setState({
        pendingFollows: [
          { id: 'f-reject', followerId: 'u-c', followerNickname: 'Charlie', createdAt: '2026-01-03T00:00:00Z' },
        ],
      });

      mockRespondToFollowExecute.mockResolvedValue(undefined);

      await useSocialStore.getState().respondToFollow('f-reject', false);

      expect(mockRespondToFollowExecute).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject' }),
      );
    });

    it('handles respond error', async () => {
      mockRespondToFollowExecute.mockRejectedValue(new Error('Not authorized'));

      await useSocialStore.getState().respondToFollow('f-x', true);

      expect(useSocialStore.getState().error).toBe('Not authorized');
    });
  });

  describe('fetchPendingFollows', () => {
    it('loads pending follows via UC', async () => {
      const pending = [
        { id: 'f-1', followerId: 'u-a', followerNickname: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
      ];
      mockGetPendingFollowsExecute.mockResolvedValue({ pendingFollows: pending });

      await useSocialStore.getState().fetchPendingFollows();

      expect(useSocialStore.getState().pendingFollows).toEqual(pending);
    });

    it('silently ignores errors without setting error state', async () => {
      mockGetPendingFollowsExecute.mockRejectedValue(new Error('DB error'));

      await useSocialStore.getState().fetchPendingFollows();

      // 에러를 무시한다 (메인 피드에 영향 없음)
      expect(useSocialStore.getState().error).toBeNull();
    });
  });

  describe('clearSearch / clearError', () => {
    it('clearSearch resets search results', () => {
      useSocialStore.setState({
        searchResults: [
          { id: 'u1', nickname: 'test', avatarUrl: null, grade: null, followStatus: null, followId: null },
        ],
      });

      useSocialStore.getState().clearSearch();

      expect(useSocialStore.getState().searchResults).toEqual([]);
    });

    it('clearError resets error state', () => {
      useSocialStore.setState({ error: 'some error' });

      useSocialStore.getState().clearError();

      expect(useSocialStore.getState().error).toBeNull();
    });
  });
});
