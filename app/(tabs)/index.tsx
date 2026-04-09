import React, { useEffect, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';

import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import useExamStore from '@/presentation/stores/useExamStore';
import { getSubjectLabel } from '@/domain/rules/subjectRules';
import type { Exam } from '@/domain/entities';
import type { ExamStatus } from '@/domain/value-objects/ExamStatus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'all' | ExamStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'processing', label: '분석중' },
  { key: 'completed', label: '완료' },
  { key: 'error', label: '실패' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: ExamStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case 'processing':
      return { label: '분석중', color: '#2563EB', bg: '#EFF6FF' };
    case 'ocr_done':
      return { label: 'OCR 완료', color: '#7C3AED', bg: '#F5F3FF' };
    case 'verified':
      return { label: '검증됨', color: '#0891B2', bg: '#ECFEFF' };
    case 'analyzed':
      return { label: '분석완료', color: COLORS.accent, bg: '#ECFDF5' };
    case 'completed':
      return { label: '완료', color: COLORS.accent, bg: '#ECFDF5' };
    case 'error':
      return { label: '실패', color: COLORS.alert, bg: '#FEF2F2' };
    default:
      return { label: status, color: COLORS.textSecondary, bg: COLORS.background };
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExamsScreen() {
  // useExamStore에서 시험 목록·로딩 상태·에러·fetchExams를 가져온다.
  // 직접 supabase.from('exams')를 호출하지 않고 스토어를 통해 접근한다.
  const exams = useExamStore((s) => s.exams);
  const isLoading = useExamStore((s) => s.isLoading);
  const storeError = useExamStore((s) => s.error);
  const fetchExams = useExamStore((s) => s.fetchExams);
  const clearError = useExamStore((s) => s.clearError);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // 컴포넌트 마운트 시 한 번 시험 목록을 불러온다.
  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // 당겨서 새로고침 처리: 완료 후 refreshing 상태를 해제한다.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchExams();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchExams]);

  // ---- Filter ----
  // activeFilter 또는 exams 배열이 바뀔 때만 재계산한다.
  const filteredExams = useMemo(
    () => (activeFilter === 'all' ? exams : exams.filter((e) => e.status === activeFilter)),
    [exams, activeFilter],
  );

  // ---- Render item ----
  const renderExamCard = useCallback(({ item }: { item: Exam }) => {
    const badge = getStatusBadge(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/exam/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          {/* Subject badge */}
          <View style={styles.subjectBadge}>
            <Text style={styles.subjectBadgeText}>{getSubjectLabel(item.subject)}</Text>
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {/* Exam 엔티티는 camelCase를 사용한다 */}
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, []);

  // ---- Empty state ----
  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>아직 업로드한 시험이 없습니다</Text>
        <Text style={styles.emptySubtext}>
          하단의 업로드 탭에서 시험지를 촬영해 보세요
        </Text>
      </View>
    );
  }, [isLoading]);

  // ---- Render ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>내 시험</Text>

        {/* Error banner */}
        {storeError && (
          <TouchableOpacity onPress={clearError}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{storeError}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.filterTabText, isActive && styles.filterTabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Exam list */}
        {!isLoading && (
          <FlatList
            data={filteredExams}
            keyExtractor={(item) => item.id}
            renderItem={renderExamCard}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmpty}
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
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  // Error banner
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: COLORS.alert,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.alert,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: MIN_TOUCH_TARGET - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: COLORS.white,
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

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  subjectBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  subjectBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statusBadge: {
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  statusBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});
