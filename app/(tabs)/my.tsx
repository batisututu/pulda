import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import { Card, ErrorBanner } from '@/presentation/components/common';
import useAuthStore from '@/presentation/stores/useAuthStore';
import { createGetMyPageDataUseCase } from '@/di/container';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditInfo {
  total: number;
  used: number;
  remaining: number;
  plan: string;
  resetAt: string | null;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function planLabel(plan: string): string {
  switch (plan) {
    case 'free':
      return 'Free';
    case 'basic':
      return 'Basic';
    case 'premium':
      return 'Premium';
    case 'premium_plus':
      return 'Premium+';
    default:
      return plan;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '활성';
    case 'cancelled':
      return '해지됨';
    case 'expired':
      return '만료';
    case 'pending':
      return '대기 중';
    default:
      return status;
  }
}

function getInitial(nickname?: string, email?: string): string {
  if (nickname && nickname.length > 0) return nickname[0].toUpperCase();
  if (email && email.length > 0) return email[0].toUpperCase();
  return '?';
}

// ---------------------------------------------------------------------------
// Menu Item
// ---------------------------------------------------------------------------

interface MenuItemProps {
  label: string;
  onPress: () => void;
}

function MenuItem({ label, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
    >
      <Text style={styles.menuItemText}>{label}</Text>
      <Text style={styles.menuItemArrow}>{'>'}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MyScreen() {
  const { user, logout } = useAuthStore();

  const [credit, setCredit] = useState<CreditInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 크레딧 및 구독 정보 조회
  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const useCase = createGetMyPageDataUseCase();
      const { credit: creditData, subscription: subData } = await useCase.execute({ userId: user.id });

      if (creditData) {
        setCredit({
          total: creditData.total,
          used: creditData.used,
          remaining: Math.max(creditData.total - creditData.used, 0),
          plan: creditData.plan,
          resetAt: creditData.resetAt,
        });
      } else {
        setCredit(null);
      }

      if (subData) {
        setSubscription({
          plan: subData.plan,
          status: subData.status,
          expiresAt: subData.expiresAt,
        });
      } else {
        setSubscription(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '정보를 불러올 수 없습니다.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Handlers
  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout]);

  const handleExamHistory = useCallback(() => {
    router.push('/(tabs)');
  }, []);

  // Progress bar ratio
  const creditRatio = credit ? (credit.total > 0 ? credit.remaining / credit.total : 0) : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>마이페이지</Text>

        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

        {/* Profile Section */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitial(user?.nickname, user?.email)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.nickname}>
                {user?.nickname || '사용자'}
              </Text>
              <Text style={styles.email}>{user?.email ?? ''}</Text>
              {user?.grade ? (
                <Text style={styles.grade}>{user.grade}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Credit Card */}
        {isLoading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : credit ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardLabel}>남은 크레딧</Text>
            <Text style={styles.creditValue}>
              {credit.remaining} / {credit.total}
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.round(creditRatio * 100)}%` },
                ]}
              />
            </View>
            {credit.resetAt ? (
              <Text style={styles.resetDate}>
                리셋 예정: {formatDate(credit.resetAt)}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardLabel}>크레딧</Text>
            <Text style={styles.cardMuted}>크레딧 정보가 없습니다.</Text>
          </Card>
        )}

        {/* Subscription Card */}
        {!isLoading ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.cardLabel}>구독</Text>
            {subscription ? (
              <View style={styles.subscriptionRow}>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>
                    {planLabel(subscription.plan)}
                  </Text>
                </View>
                <Text style={styles.subscriptionStatus}>
                  {statusLabel(subscription.status)}
                </Text>
                {subscription.expiresAt ? (
                  <Text style={styles.expiresDate}>
                    만료: {formatDate(subscription.expiresAt)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.subscriptionRow}>
                <View style={[styles.planBadge, styles.planBadgeFree]}>
                  <Text style={[styles.planBadgeText, styles.planBadgeTextFree]}>
                    Free
                  </Text>
                </View>
                <Text style={styles.cardMuted}>무료 플랜 사용 중</Text>
              </View>
            )}
          </Card>
        ) : null}

        {/* Menu List */}
        <View style={styles.menuSection}>
          <MenuItem label="내 시험 기록" onPress={handleExamHistory} />
          {user?.role === 'parent' ? (
            <MenuItem
              label="자녀 학습 현황"
              onPress={() => router.push('/parent/dashboard')}
            />
          ) : null}
          <MenuItem
            label="알림"
            onPress={() => router.push('/notifications')}
          />
          <MenuItem label="도움말" onPress={() => router.push('/help')} />
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  pageTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },

  // Profile
  profileCard: {
    marginBottom: SPACING.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  nickname: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  email: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  grade: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },

  // Loading
  loadingSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },

  // Cards
  sectionCard: {
    marginBottom: SPACING.md,
  },
  cardLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  cardMuted: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },

  // Credit
  creditValue: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.pill,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.pill,
  },
  resetDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.xs,
  },

  // Subscription
  subscriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  planBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.pill,
  },
  planBadgeFree: {
    backgroundColor: COLORS.border,
  },
  planBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  planBadgeTextFree: {
    color: COLORS.textSecondary,
  },
  subscriptionStatus: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
    fontWeight: '600',
  },
  expiresDate: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },

  // Menu
  menuSection: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  menuItemArrow: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },

  // Logout
  logoutSection: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  logoutButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.alert,
  },
  logoutText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.alert,
  },
});
