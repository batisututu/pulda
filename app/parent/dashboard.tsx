import React, { useState, useEffect, useCallback } from 'react';
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
import { Card, EmptyState, ErrorBanner, Modal, Input, Button } from '@/presentation/components/common';
import useParentStore from '@/presentation/stores/useParentStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    concept_gap: '개념 부족',
    calculation_error: '계산 실수',
    time_pressure: '시간 부족',
    comprehension_error: '이해 오류',
    grammar_error: '문법 오류',
    vocabulary_gap: '어휘 부족',
    interpretation_error: '해석 오류',
  };
  return labels[type] ?? type;
}

function getErrorTypeColor(type: string): string {
  const colors: Record<string, string> = {
    concept_gap: COLORS.conceptGap,
    calculation_error: COLORS.calculationError,
    time_pressure: COLORS.timePressure,
    comprehension_error: COLORS.conceptGap,
    grammar_error: COLORS.calculationError,
    vocabulary_gap: '#8B5CF6',
    interpretation_error: '#EC4899',
  };
  return colors[type] ?? COLORS.textSecondary;
}

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return remainMin > 0 ? `${hours}시간 ${remainMin}분` : `${hours}시간`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ParentDashboardScreen() {
  const {
    children,
    dashboard,
    isLoading,
    error,
    fetchChildren,
    fetchDashboard,
    linkWithCode,
    clearError,
  } = useParentStore();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Initial load
  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  // Auto-select first child when children load
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].childUserId);
    }
  }, [children, selectedChildId]);

  // Fetch dashboard when child is selected
  useEffect(() => {
    if (selectedChildId) {
      fetchDashboard(selectedChildId);
    }
  }, [selectedChildId, fetchDashboard]);

  // Handle link code submission
  const handleLinkSubmit = useCallback(async () => {
    const trimmed = linkCodeInput.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setLinkError('6자리 코드를 입력해 주세요.');
      return;
    }

    setIsLinking(true);
    setLinkError(null);

    try {
      await linkWithCode(trimmed);
      setShowLinkModal(false);
      setLinkCodeInput('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '연동에 실패했습니다.';
      setLinkError(message);
    } finally {
      setIsLinking(false);
    }
  }, [linkCodeInput, linkWithCode]);

  const data = dashboard?.data;

  // Computed: average accuracy from test scores
  const avgAccuracy = data?.testScores && data.testScores.length > 0
    ? Math.round(
        data.testScores.reduce((sum, t) => sum + (t.total > 0 ? (t.score / t.total) * 100 : 0), 0)
        / data.testScores.length,
      )
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>자녀 학습 현황</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}

      {/* Loading state */}
      {isLoading && children.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      ) : children.length === 0 ? (
        /* No children linked */
        <EmptyState
          title="연결된 자녀가 없습니다"
          description="자녀의 학습 현황을 확인하려면 자녀가 생성한 링크 코드를 입력해 주세요."
          action={{
            title: '링크 코드 입력',
            onPress: () => setShowLinkModal(true),
          }}
        />
      ) : (
        /* Children exist: show dashboard */
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Child selection tabs */}
          {children.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabContainer}
              contentContainerStyle={styles.tabContent}
            >
              {children.map((child) => {
                const isSelected = child.childUserId === selectedChildId;
                return (
                  <TouchableOpacity
                    key={child.id}
                    style={[styles.tab, isSelected && styles.tabSelected]}
                    onPress={() => setSelectedChildId(child.childUserId)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        isSelected && styles.tabTextSelected,
                      ]}
                    >
                      {dashboard?.childNickname && child.childUserId === selectedChildId
                        ? dashboard.childNickname
                        : `자녀 ${children.indexOf(child) + 1}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Dashboard loading */}
          {isLoading && selectedChildId ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : data ? (
            <>
              {/* Child info */}
              {dashboard ? (
                <Card style={styles.childInfoCard}>
                  <Text style={styles.childName}>
                    {dashboard.childNickname || '자녀'}
                  </Text>
                  {dashboard.childGrade ? (
                    <Text style={styles.childGrade}>{dashboard.childGrade}</Text>
                  ) : null}
                </Card>
              ) : null}

              {/* Weekly stats card */}
              <Card style={styles.sectionCard}>
                <Text style={styles.cardLabel}>이번 주 학습 현황</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {data.weeklyStats.questionsSolved}
                    </Text>
                    <Text style={styles.statLabel}>풀이 문항</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {formatStudyTime(data.weeklyStats.studyTime)}
                    </Text>
                    <Text style={styles.statLabel}>학습 시간</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {data.weeklyStats.loginDays}일
                    </Text>
                    <Text style={styles.statLabel}>접속일</Text>
                  </View>
                </View>
              </Card>

              {/* Aggregate stats card */}
              <Card style={styles.sectionCard}>
                <Text style={styles.cardLabel}>학습 통계</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {data.testScores.length}
                    </Text>
                    <Text style={styles.statLabel}>총 시험 수</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: COLORS.primary }]}>
                      {avgAccuracy !== null ? `${avgAccuracy}%` : '-'}
                    </Text>
                    <Text style={styles.statLabel}>평균 정답률</Text>
                  </View>
                </View>
              </Card>

              {/* Error distribution */}
              {data.errorDistribution.length > 0 ? (
                <Card style={styles.sectionCard}>
                  <Text style={styles.cardLabel}>오류 유형 분포</Text>
                  {data.errorDistribution
                    .sort((a, b) => b.count - a.count)
                    .map((item) => {
                      const total = data.errorDistribution.reduce(
                        (sum, e) => sum + e.count,
                        0,
                      );
                      const ratio = total > 0 ? item.count / total : 0;
                      const color = getErrorTypeColor(item.type);

                      return (
                        <View key={item.type} style={styles.errorRow}>
                          <View style={styles.errorLabelRow}>
                            <View
                              style={[
                                styles.errorDot,
                                { backgroundColor: color },
                              ]}
                            />
                            <Text style={styles.errorLabel}>
                              {getErrorTypeLabel(item.type)}
                            </Text>
                            <Text style={styles.errorCount}>{item.count}건</Text>
                          </View>
                          <View style={styles.errorBarBg}>
                            <View
                              style={[
                                styles.errorBarFill,
                                {
                                  width: `${Math.round(ratio * 100)}%`,
                                  backgroundColor: color,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                </Card>
              ) : null}

              {/* Weakness heatmap */}
              {data.weaknessHeatmap.length > 0 ? (
                <Card style={styles.sectionCard}>
                  <Text style={styles.cardLabel}>약점 분야</Text>
                  {data.weaknessHeatmap
                    .sort((a, b) => b.proportion - a.proportion)
                    .slice(0, 5)
                    .map((item) => (
                      <View key={item.unit} style={styles.weaknessRow}>
                        <Text style={styles.weaknessUnit}>{item.unit}</Text>
                        <Text style={styles.weaknessCount}>
                          {item.questionCount}회 출제
                        </Text>
                      </View>
                    ))}
                </Card>
              ) : null}

              {/* Recent test scores */}
              {data.testScores.length > 0 ? (
                <Card style={styles.sectionCard}>
                  <Text style={styles.cardLabel}>최근 시험 기록</Text>
                  {data.testScores.slice(0, 10).map((score, idx) => {
                    const pct =
                      score.total > 0
                        ? Math.round((score.score / score.total) * 100)
                        : 0;
                    return (
                      <View key={idx} style={styles.scoreRow}>
                        <Text style={styles.scoreDate}>
                          {formatDate(score.date)}
                        </Text>
                        <View style={styles.scoreBarBg}>
                          <View
                            style={[
                              styles.scoreBarFill,
                              { width: `${pct}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.scorePct}>{pct}%</Text>
                      </View>
                    );
                  })}
                </Card>
              ) : null}

              {/* Link another child */}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowLinkModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.linkButtonText}>링크 코드 입력</Text>
              </TouchableOpacity>

              <View style={{ height: SPACING.xxl }} />
            </>
          ) : null}
        </ScrollView>
      )}

      {/* Link code input modal */}
      <Modal
        visible={showLinkModal}
        onClose={() => {
          setShowLinkModal(false);
          setLinkCodeInput('');
          setLinkError(null);
        }}
        title="링크 코드 입력"
      >
        <Text style={styles.modalDesc}>
          자녀가 생성한 6자리 링크 코드를 입력해 주세요.
        </Text>
        <View style={styles.modalInputWrapper}>
          <Input
            placeholder="ABC123"
            value={linkCodeInput}
            onChangeText={(text) => {
              setLinkCodeInput(text.toUpperCase());
              setLinkError(null);
            }}
            autoCapitalize="characters"
            maxLength={6}
            error={linkError ?? undefined}
          />
        </View>
        <Button
          title="연동하기"
          onPress={handleLinkSubmit}
          loading={isLinking}
          disabled={linkCodeInput.trim().length !== 6}
          fullWidth
        />
      </Modal>
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },

  // Tabs
  tabContainer: {
    marginBottom: SPACING.md,
    maxHeight: 44,
  },
  tabContent: {
    gap: SPACING.sm,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextSelected: {
    color: COLORS.white,
  },

  // Loading
  loadingSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },

  // Child info
  childInfoCard: {
    marginBottom: SPACING.md,
  },
  childName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  childGrade: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
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

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },

  // Error distribution
  errorRow: {
    marginBottom: SPACING.sm,
  },
  errorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  errorLabel: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  errorCount: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  errorBarBg: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.pill,
    overflow: 'hidden',
  },
  errorBarFill: {
    height: 6,
    borderRadius: BORDER_RADIUS.pill,
  },

  // Weakness
  weaknessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  weaknessUnit: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  weaknessCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },

  // Score rows
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  scoreDate: {
    width: 40,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.pill,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.pill,
  },
  scorePct: {
    width: 36,
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },

  // Link button
  linkButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  linkButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Modal
  modalDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  modalInputWrapper: {
    marginBottom: SPACING.md,
  },
});
