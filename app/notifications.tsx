import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import { EmptyState, ErrorBanner } from '@/presentation/components/common';
import useAuthStore from '@/presentation/stores/useAuthStore';
import {
  createGetNotificationsUseCase,
  createMarkNotificationReadUseCase,
} from '@/di/container';
import type { Notification } from '@/domain/entities';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return '어제';
  if (diffDay < 7) return `${diffDay}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'follow_request':
      return '+';
    case 'follow_accepted':
      return 'O';
    case 'exam_analyzed':
      return 'A';
    case 'minitest_completed':
      return 'T';
    case 'parent_linked':
      return 'P';
    case 'item_shared':
      return 'S';
    default:
      return 'N';
  }
}

function navigateByType(type: string, data: Record<string, unknown> | null) {
  switch (type) {
    case 'follow_request':
    case 'follow_accepted':
    case 'item_shared':
      router.push('/(tabs)/social');
      break;
    case 'exam_analyzed':
      if (data?.examId) {
        router.push(`/exam/${data.examId}`);
      }
      break;
    case 'minitest_completed':
      if (data?.testId) {
        router.push(`/solve/${data.testId}`);
      }
      break;
    case 'parent_linked':
      router.push('/parent/dashboard');
      break;
    default:
      // No navigation, just mark as read
      break;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NotificationsScreen() {
  const user = useAuthStore((s) => s.user);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!user) return;

    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const useCase = createGetNotificationsUseCase();
      const result = await useCase.execute({ userId: user.id });

      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알림을 불러올 수 없습니다.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchNotifications(true);
  }, [fetchNotifications]);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (!user || unreadCount === 0) return;

    try {
      const useCase = createMarkNotificationReadUseCase();
      await useCase.execute({ userId: user.id });

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true })),
      );
      setUnreadCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '읽음 처리에 실패했습니다.';
      setError(message);
    }
  }, [user, unreadCount]);

  // Tap a notification
  const handlePress = useCallback(async (notification: Notification) => {
    if (!user) return;

    // Mark as read if unread
    if (!notification.isRead) {
      try {
        const useCase = createMarkNotificationReadUseCase();
        await useCase.execute({
          userId: user.id,
          notificationId: notification.id,
        });

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n,
          ),
        );
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      } catch {
        // Silently fail, still navigate
      }
    }

    // Navigate based on type
    navigateByType(notification.type, notification.data);
  }, [user]);

  // Render notification item
  const renderItem = useCallback(({ item }: { item: Notification }) => {
    const isUnread = !item.isRead;

    return (
      <TouchableOpacity
        style={[
          styles.notifItem,
          isUnread && styles.notifItemUnread,
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.6}
      >
        <View style={[styles.notifIcon, isUnread && styles.notifIconUnread]}>
          <Text style={[styles.notifIconText, isUnread && styles.notifIconTextUnread]}>
            {getNotificationIcon(item.type)}
          </Text>
        </View>
        <View style={styles.notifContent}>
          <Text
            style={[
              styles.notifTitle,
              isUnread && styles.notifTitleUnread,
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.body ? (
            <Text style={styles.notifBody} numberOfLines={2}>
              {item.body}
            </Text>
          ) : null}
          <Text style={styles.notifTime}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handlePress]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>알림</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.markAllButton}
            activeOpacity={0.6}
          >
            <Text style={styles.markAllText}>모두 읽음</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {error ? (
        <View style={styles.errorWrapper}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      {/* Loading */}
      {isLoading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="새로운 알림이 없습니다"
          description="새로운 소식이 생기면 여기에 알려드릴게요."
        />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '600',
    color: COLORS.primary,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: {
    width: MIN_TOUCH_TARGET,
  },
  markAllButton: {
    minWidth: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  markAllText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Error
  errorWrapper: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },

  // List
  listContent: {
    paddingVertical: SPACING.sm,
  },

  // Notification item
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  notifItemUnread: {
    backgroundColor: COLORS.primaryLight + '0F', // ~6% opacity
  },

  // Icon
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  notifIconUnread: {
    backgroundColor: COLORS.primaryLight + '30', // ~19% opacity
  },
  notifIconText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textTertiary,
  },
  notifIconTextUnread: {
    color: COLORS.primary,
  },

  // Content
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  notifTitleUnread: {
    fontWeight: '700',
  },
  notifBody: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
});
