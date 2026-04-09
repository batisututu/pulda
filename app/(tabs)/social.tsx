import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import { Card, Button, EmptyState, ErrorBanner } from '@/presentation/components/common';
import useAuthStore from '@/presentation/stores/useAuthStore';
import useSocialStore from '@/presentation/stores/useSocialStore';
import type { FeedItem, SearchUserItem, PendingFollow } from '@/presentation/stores/useSocialStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일`;
}

function getInitial(nickname: string): string {
  if (nickname.length > 0) return nickname[0].toUpperCase();
  return '?';
}

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  variant_set: { label: '변형문항', color: '#7C3AED', bg: '#F5F3FF' },
  error_note: { label: '오답노트', color: '#F43F5E', bg: '#FFF1F2' },
  mini_test_result: { label: '미니테스트', color: '#2563EB', bg: '#EFF6FF' },
  blueprint: { label: '블루프린트', color: '#10B981', bg: '#ECFDF5' },
};

function getItemTypeBadge(itemType: string) {
  return ITEM_TYPE_LABELS[itemType] ?? { label: itemType, color: COLORS.textSecondary, bg: COLORS.background };
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function Avatar({ nickname, size = 40 }: { nickname: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {getInitial(nickname)}
      </Text>
    </View>
  );
}

/** 팔로우 요청 알림 카드 (내부 UI) */
function PendingFollowCardInner({
  item,
  onAccept,
  onReject,
}: {
  item: PendingFollow;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.pendingCard}>
      <Avatar nickname={item.followerNickname} size={36} />
      <View style={styles.pendingInfo}>
        <Text style={styles.pendingNickname} numberOfLines={1}>
          {item.followerNickname}
        </Text>
        <Text style={styles.pendingSubtext}>팔로우 요청</Text>
      </View>
      <View style={styles.pendingActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={onAccept}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="수락"
        >
          <Text style={styles.acceptButtonText}>수락</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={onReject}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="거절"
        >
          <Text style={styles.rejectButtonText}>거절</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * 팔로우 요청 행 — React.memo로 감싸 id·nickname 변경 시에만 리렌더링된다.
 * onRespond 콜백을 accept boolean과 함께 받아 인라인 화살표 함수 생성을 피한다.
 */
const PendingFollowRow = memo(function PendingFollowRow({
  item,
  onRespond,
}: {
  item: PendingFollow;
  onRespond: (id: string, accept: boolean) => void;
}) {
  const handleAccept = useCallback(() => onRespond(item.id, true), [item.id, onRespond]);
  const handleReject = useCallback(() => onRespond(item.id, false), [item.id, onRespond]);

  return (
    <PendingFollowCardInner
      item={item}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );
});

/** 검색 결과 유저 행 — React.memo로 감싸 user 객체 변경 시에만 리렌더링된다. */
const SearchUserRow = memo(function SearchUserRow({
  user,
  onFollow,
}: {
  user: SearchUserItem;
  onFollow: () => void;
}) {
  const isFollowing = user.followStatus === 'accepted';
  const isPending = user.followStatus === 'pending';

  return (
    <View style={styles.searchRow}>
      <Avatar nickname={user.nickname} size={40} />
      <View style={styles.searchInfo}>
        <Text style={styles.searchNickname} numberOfLines={1}>
          {user.nickname}
        </Text>
        {user.grade ? (
          <Text style={styles.searchGrade}>{user.grade}</Text>
        ) : null}
      </View>
      {isFollowing ? (
        <View style={styles.followingBadge}>
          <Text style={styles.followingBadgeText}>팔로잉</Text>
        </View>
      ) : isPending ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>요청됨</Text>
        </View>
      ) : (
        <Button
          title="팔로우"
          onPress={onFollow}
          variant="outline"
          size="sm"
        />
      )}
    </View>
  );
});

/** 피드 카드 */
function FeedCard({ item }: { item: FeedItem }) {
  const badge = getItemTypeBadge(item.itemType);

  return (
    <Card style={styles.feedCard}>
      <View style={styles.feedCardHeader}>
        <View style={styles.feedAuthorRow}>
          <Avatar nickname={item.authorNickname} size={32} />
          <Text style={styles.feedAuthorName} numberOfLines={1}>
            {item.authorNickname}
          </Text>
        </View>
        <View style={[styles.itemTypeBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.itemTypeBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>
      {item.caption ? (
        <Text style={styles.feedCaption} numberOfLines={3}>
          {item.caption}
        </Text>
      ) : null}
      <Text style={styles.feedDate}>{formatDate(item.createdAt)}</Text>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SocialScreen() {
  const user = useAuthStore((s) => s.user);

  const {
    feed,
    hasMore,
    searchResults,
    pendingFollows,
    isLoading,
    isSearching,
    isLoadingMore,
    error,
    fetchFeed,
    loadMore,
    fetchPendingFollows,
    searchUsers,
    followUser,
    respondToFollow,
    clearSearch,
    clearError,
  } = useSocialStore();

  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 초기 로딩 ----
  useEffect(() => {
    if (user) {
      fetchFeed();
      fetchPendingFollows();
    }
  }, [user, fetchFeed, fetchPendingFollows]);

  // ---- 검색 디바운스 ----
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (text.length < 2) {
      clearSearch();
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      searchUsers(text);
    }, 400);
  }, [searchUsers, clearSearch]);

  // ---- 검색 모드 토글 ----
  const toggleSearchMode = useCallback(() => {
    if (isSearchMode) {
      setIsSearchMode(false);
      setSearchQuery('');
      clearSearch();
    } else {
      setIsSearchMode(true);
    }
  }, [isSearchMode, clearSearch]);

  // ---- 당겨서 새로고침 ----
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchFeed(), fetchPendingFollows()]);
    setIsRefreshing(false);
  }, [fetchFeed, fetchPendingFollows]);

  // ---- 팔로우 ----
  const handleFollow = useCallback((targetUserId: string) => {
    followUser(targetUserId);
  }, [followUser]);

  // ---- 팔로우 응답 ----
  const handleRespondToFollow = useCallback((followId: string, accept: boolean) => {
    respondToFollow(followId, accept);
  }, [respondToFollow]);

  // ---- 무한 스크롤 ----
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // ---- 피드 헤더 (pending follows) ----
  // PendingFollowRow에 handleRespondToFollow를 stable prop으로 전달한다.
  // 각 행은 내부에서 item.id를 클로저로 캡처하므로 인라인 화살표 함수가 필요없다.
  const renderFeedHeader = useCallback(() => {
    if (pendingFollows.length === 0) return null;

    return (
      <View style={styles.pendingSection}>
        <Text style={styles.pendingSectionTitle}>
          팔로우 요청 ({pendingFollows.length})
        </Text>
        {pendingFollows.map((item) => (
          <PendingFollowRow
            key={item.id}
            item={item}
            onRespond={handleRespondToFollow}
          />
        ))}
      </View>
    );
  }, [pendingFollows, handleRespondToFollow]);

  // ---- 피드 아이템 렌더 ----
  const renderFeedItem = useCallback(({ item }: { item: FeedItem }) => {
    return <FeedCard item={item} />;
  }, []);

  // ---- 피드 빈 상태 ----
  const renderFeedEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="👥"
        title="아직 피드가 없습니다"
        description="친구를 팔로우해보세요!"
        action={{
          title: '친구 검색',
          onPress: () => setIsSearchMode(true),
        }}
      />
    );
  }, [isLoading]);

  // ---- 피드 푸터 (로딩 더보기) ----
  const renderFeedFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }, [isLoadingMore]);

  // ---- 검색 결과 렌더 ----
  const renderSearchItem = useCallback(({ item }: { item: SearchUserItem }) => {
    return (
      <SearchUserRow
        user={item}
        onFollow={() => handleFollow(item.id)}
      />
    );
  }, [handleFollow]);

  // ---- 검색 빈 상태 ----
  const renderSearchEmpty = useCallback(() => {
    if (isSearching) return null;
    if (searchQuery.length < 2) {
      return (
        <View style={styles.searchHintContainer}>
          <Text style={styles.searchHintText}>
            닉네임으로 검색하세요 (2자 이상)
          </Text>
        </View>
      );
    }
    return (
      <EmptyState
        icon="🔍"
        title="검색 결과가 없습니다"
        description="다른 닉네임으로 검색해보세요"
      />
    );
  }, [isSearching, searchQuery]);

  // ---- 메인 렌더 ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isSearchMode ? '친구 검색' : '소셜'}
          </Text>
          <TouchableOpacity
            onPress={toggleSearchMode}
            style={styles.searchToggle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isSearchMode ? '검색 닫기' : '검색 열기'}
          >
            <Text style={styles.searchToggleText}>
              {isSearchMode ? '닫기' : '🔍'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 에러 배너 */}
        {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}

        {/* 검색 모드 */}
        {isSearchMode ? (
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="닉네임 검색..."
                placeholderTextColor={COLORS.textTertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => {
                    setSearchQuery('');
                    clearSearch();
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {isSearching ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={renderSearchItem}
                ListEmptyComponent={renderSearchEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        ) : (
          /* 피드 모드 */
          <>
            {isLoading && feed.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                data={feed}
                keyExtractor={(item) => item.id}
                renderItem={renderFeedItem}
                ListHeaderComponent={renderFeedHeader}
                ListEmptyComponent={renderFeedEmpty}
                ListFooterComponent={renderFeedFooter}
                contentContainerStyle={styles.listContent}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                refreshControl={
                  <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={COLORS.primary}
                    colors={[COLORS.primary]}
                  />
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  searchToggle: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchToggleText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  listContent: {
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },

  // Avatar
  avatar: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    color: COLORS.white,
  },

  // ---------- Pending Follows Section ----------
  pendingSection: {
    marginBottom: SPACING.md,
  },
  pendingSectionTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pendingInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  pendingNickname: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  pendingSubtext: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  acceptButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.white,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // ---------- Search Section ----------
  searchSection: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: SPACING.sm,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  clearButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },
  searchLoadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  searchHintContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  searchHintText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },

  // ---------- Search Result Row ----------
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  searchNickname: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  searchGrade: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  followingBadge: {
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  followingBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pendingBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  pendingBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  // ---------- Feed Card ----------
  feedCard: {
    marginBottom: SPACING.sm,
  },
  feedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  feedAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  feedAuthorName: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
  },
  itemTypeBadge: {
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  itemTypeBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  feedCaption: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  feedDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },

  // ---------- Load More ----------
  loadMoreContainer: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});
