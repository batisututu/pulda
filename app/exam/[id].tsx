import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import useAuthStore from '@/presentation/stores/useAuthStore';
import { getSubjectLabel } from '@/domain/rules/subjectRules';
import { DistributionChart } from '@/presentation/components/blueprint/DistributionChart';
import { VisualExplanationRenderer } from '@/presentation/components/visual/VisualExplanationRenderer';
import { createGetDiagnosisUseCase, createGetExamDetailUseCase, createCreateMiniTestUseCase } from '@/di/container';
import type { SubjectOrOther } from '@/domain/value-objects/Subject';
import type { ExamStatus } from '@/domain/value-objects/ExamStatus';
import type { ErrorType } from '@/domain/value-objects/ErrorType';
import type { VisualExplanation } from '@/domain/value-objects/VisualExplanation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamData {
  id: string;
  subject: SubjectOrOther;
  status: ExamStatus;
  created_at: string;
  image_url: string | null;
}

interface QuestionData {
  id: string;
  number: number;
  content: string;
  is_correct: boolean | null;
  student_answer: string | null;
  answer: string | null;
}

interface BlueprintData {
  id: string;
  unit_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
  difficulty_distribution: Record<string, number>;
  insights: string[] | null;
}

interface DiagnosisData {
  id: string;
  question_id: string;
  error_type: ErrorType;
  confidence: number;
  reasoning: string;
  correction: string;
  step_by_step: string | null;
  visual_explanation: VisualExplanation | null;
  question?: QuestionData;
}

interface VariantData {
  id: string;
  diagnosis_id: string | null;
}

type LoadState = 'loading' | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorTypeLabel(type: ErrorType): string {
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

function getErrorTypeColor(type: ErrorType): string {
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [blueprint, setBlueprint] = useState<BlueprintData | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosisData[]>([]);
  const [variants, setVariants] = useState<VariantData[]>([]);

  // Modal
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisData | null>(null);

  // Mini test creation
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  // ---- Fetch all data ----
  // isPolling=true 일 때는 loadState를 'loading'으로 리셋하지 않는다 (백그라운드 갱신)
  const fetchData = useCallback(async (isPolling = false) => {
    if (!id || !user) return;

    if (!isPolling) {
      setLoadState('loading');
    }
    setErrorMsg(null);

    try {
      // GetDiagnosisUseCase 한 번 호출로 blueprint, diagnoses, variants를 모두 가져온다.
      // exam 소유권 검증도 내부에서 처리된다.
      const useCase = createGetDiagnosisUseCase();
      const result = await useCase.execute({ userId: user.id, examId: id });

      // 진단 결과가 없을 때도 exam 정보는 필요하므로 별도로 조회한다.
      // (GetDiagnosisUseCase는 exam을 내부 검증에만 사용하고 반환하지 않는다)
      const examUseCase = createGetExamDetailUseCase();
      const { exam: examEntity } = await examUseCase.execute({ userId: user.id, examId: id });
      setExam({
        id: examEntity.id,
        subject: examEntity.subject as SubjectOrOther,
        status: examEntity.status as ExamStatus,
        created_at: examEntity.createdAt,
        image_url: examEntity.imageUrl,
      });

      // Blueprint: 도메인 엔티티(camelCase) → 화면 인터페이스(snake_case) 변환
      if (result.blueprint) {
        const bp = result.blueprint;
        setBlueprint({
          id: bp.id,
          unit_distribution: bp.unitDistribution,
          type_distribution: bp.typeDistribution,
          difficulty_distribution: bp.difficultyDistribution,
          insights: bp.insights,
        });
      } else {
        setBlueprint(null);
      }

      // 진단 목록에서 문항 데이터를 추출한다 (중복 제거)
      const questionMap = new Map<string, QuestionData>();
      for (const diag of result.diagnoses) {
        const q = diag.question;
        if (!questionMap.has(q.id)) {
          questionMap.set(q.id, {
            id: q.id,
            number: q.number,
            content: q.content,
            is_correct: q.isCorrect,
            student_answer: q.studentAnswer,
            answer: q.answer,
          });
        }
      }
      // summary에서 총 문항 수를 맞추기 위해 placeholder 추가 (정답 문항은 diagnoses에 없음)
      setQuestions(Array.from(questionMap.values()));

      // 진단 데이터 변환: 화면 인터페이스(snake_case) 형태로 매핑
      const mappedDiagnoses: DiagnosisData[] = result.diagnoses.map((diag) => ({
        id: diag.id,
        question_id: diag.questionId,
        error_type: diag.errorType,
        confidence: diag.confidence,
        reasoning: diag.reasoning,
        correction: diag.correction,
        step_by_step: diag.stepByStep,
        visual_explanation: diag.visualExplanation,
        question: {
          id: diag.question.id,
          number: diag.question.number,
          content: diag.question.content,
          is_correct: diag.question.isCorrect,
          student_answer: diag.question.studentAnswer,
          answer: diag.question.answer,
        },
      }));
      setDiagnoses(mappedDiagnoses);

      // variant_questions: diagnoses 배열에서 모든 variants를 flat하게 추출
      const allVariants: VariantData[] = result.diagnoses.flatMap((diag) =>
        diag.variants.map((v) => ({ id: v.id, diagnosis_id: v.diagnosisId })),
      );
      setVariants(allVariants);

      // summary의 totalQuestions를 화면의 questions 배열 대신 사용한다
      // 정답 문항은 diagnoses에 없으므로 별도 state로 summary를 보관한다
      setDiagnosisSummary(result.summary);

      setLoadState('ready');
    } catch (err) {
      setLoadState('error');
      const message = err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.';
      setErrorMsg(message);
    }
  }, [id, user]);

  // 총 문항 수·정답 수는 GetDiagnosisUseCase의 summary를 사용한다
  const [diagnosisSummary, setDiagnosisSummary] = useState<{
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    unansweredCount: number;
    accuracy: number;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Create mini test ----
  const handleCreateMiniTest = useCallback(async () => {
    if (!user || variants.length === 0) return;

    setIsCreatingTest(true);

    try {
      const variantIds = variants.map((v) => v.id);

      const createTestUseCase = createCreateMiniTestUseCase();
      const { test: newTest } = await createTestUseCase.execute({
        userId: user.id,
        variantIds,
      });

      router.push(`/solve/${newTest.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '미니테스트 생성에 실패했습니다.';
      setErrorMsg(message);
    } finally {
      setIsCreatingTest(false);
    }
  }, [user, variants]);

  // ---- Computed values ----
  // summary가 있으면 UseCase 통계를 우선 사용, 없으면 로컬 questions로 계산한다
  const totalQuestions = diagnosisSummary?.totalQuestions ?? questions.length;
  const correctCount = diagnosisSummary?.correctCount ?? questions.filter((q) => q.is_correct === true).length;
  const accuracy = totalQuestions > 0
    ? Math.round((correctCount / totalQuestions) * 100)
    : 0;

  // processing: OCR 진행 중, ocr_done: OCR 완료 → 분석 대기, verified: 분석 진행 중
  const isAnalyzing = exam?.status === 'processing' || exam?.status === 'ocr_done' || exam?.status === 'verified';
  const isAnalyzed = exam?.status === 'analyzed' || exam?.status === 'completed';

  // 분석 중일 때 5초 간격 자동 폴링 (최대 10분)
  const [pollStartTime] = useState(() => Date.now());
  const MAX_POLL_MS = 10 * 60 * 1000;

  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(() => {
      if (Date.now() - pollStartTime > MAX_POLL_MS) {
        clearInterval(interval);
        setLoadState('error');
        setErrorMsg('분석이 너무 오래 걸리고 있습니다. 나중에 다시 시도해 주세요.');
        return;
      }
      fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAnalyzing, fetchData, pollStartTime]);

  // ---- Render ----

  if (loadState === 'loading') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'error' || !exam) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>시험 결과</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centered}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg ?? '오류가 발생했습니다.'}</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData()}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>시험 결과</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Analyzing overlay */}
      {isAnalyzing && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.analyzingTitle}>AI가 분석 중입니다...</Text>
          <Text style={styles.analyzingSubtext}>
            시험지를 분석하고 있습니다. 잠시만 기다려 주세요.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => fetchData()}>
            <Text style={styles.refreshButtonText}>새로고침</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main content */}
      {!isAnalyzing && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Error banner */}
          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Exam info card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>과목</Text>
              <Text style={styles.infoValue}>{getSubjectLabel(exam.subject)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>날짜</Text>
              <Text style={styles.infoValue}>{formatDate(exam.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>문제 수</Text>
              <Text style={styles.infoValue}>{totalQuestions}문항</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>정답률</Text>
              <Text style={[styles.infoValue, styles.accuracyText]}>
                {accuracy}%
              </Text>
            </View>
          </View>

          {/* Blueprint section */}
          {blueprint && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>분석 요약</Text>

              {/* Unit distribution */}
              {blueprint.unit_distribution &&
                Object.keys(blueprint.unit_distribution).length > 0 && (
                  <View style={styles.chartCard}>
                    <DistributionChart
                      title="단원별 분포"
                      data={blueprint.unit_distribution}
                    />
                  </View>
                )}

              {/* Difficulty distribution */}
              {blueprint.difficulty_distribution &&
                Object.keys(blueprint.difficulty_distribution).length > 0 && (
                  <View style={styles.chartCard}>
                    <DistributionChart
                      title="난이도 분포"
                      data={blueprint.difficulty_distribution}
                      colorMap={{
                        easy: COLORS.accent,
                        medium: COLORS.calculationError,
                        hard: COLORS.alert,
                      }}
                    />
                  </View>
                )}

              {/* Insights */}
              {blueprint.insights && blueprint.insights.length > 0 && (
                <View style={styles.insightsCard}>
                  <Text style={styles.insightsTitle}>인사이트</Text>
                  {blueprint.insights.map((insight, i) => (
                    <View key={i} style={styles.insightRow}>
                      <Text style={styles.insightBullet}>{'  \u2022  '}</Text>
                      <Text style={styles.insightText}>{insight}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Error diagnoses (wrong answers) */}
          {isAnalyzed && diagnoses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                오답 분석 ({diagnoses.length}문항)
              </Text>

              {diagnoses.map((diag) => {
                const errorColor = getErrorTypeColor(diag.error_type);

                return (
                  <TouchableOpacity
                    key={diag.id}
                    style={styles.diagCard}
                    onPress={() => setSelectedDiagnosis(diag)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.diagCardHeader}>
                      {/* Question number */}
                      <View style={styles.questionNumberBadge}>
                        <Text style={styles.questionNumberText}>
                          {diag.question?.number ?? '?'}번
                        </Text>
                      </View>

                      {/* Error type badge */}
                      <View
                        style={[
                          styles.errorTypeBadge,
                          { backgroundColor: errorColor + '18' },
                        ]}
                      >
                        <Text style={[styles.errorTypeBadgeText, { color: errorColor }]}>
                          {getErrorTypeLabel(diag.error_type)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.diagReasoning} numberOfLines={2}>
                      {diag.reasoning}
                    </Text>

                    <Text style={styles.diagTapHint}>터치하여 상세 보기</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* No wrong answers */}
          {isAnalyzed && diagnoses.length === 0 && totalQuestions > 0 && (
            <View style={styles.section}>
              <View style={styles.perfectCard}>
                <Text style={styles.perfectIcon}>{'\\u{1F389}'}</Text>
                <Text style={styles.perfectTitle}>모든 문제를 맞혔습니다!</Text>
              </View>
            </View>
          )}

          {/* Error status */}
          {exam.status === 'error' && (
            <View style={styles.section}>
              <View style={styles.errorCard}>
                <Text style={styles.errorCardTitle}>분석 실패</Text>
                <Text style={styles.errorCardText}>
                  시험지 분석 중 오류가 발생했습니다. 다시 시도해 주세요.
                </Text>
              </View>
            </View>
          )}

          {/* Spacer for bottom button */}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom fixed button: Create mini test */}
      {isAnalyzed && variants.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.miniTestButton, isCreatingTest && styles.miniTestButtonDisabled]}
            onPress={handleCreateMiniTest}
            disabled={isCreatingTest}
            activeOpacity={0.7}
          >
            <Text style={styles.miniTestButtonText}>
              {isCreatingTest ? '생성 중...' : '미니테스트 생성'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Diagnosis detail modal */}
      <Modal
        visible={selectedDiagnosis !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDiagnosis(null)}
      >
        {selectedDiagnosis && (
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setSelectedDiagnosis(null)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>닫기</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {selectedDiagnosis.question?.number ?? '?'}번 문항 진단
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Error type */}
              <View
                style={[
                  styles.errorTypeBadgeLarge,
                  {
                    backgroundColor:
                      getErrorTypeColor(selectedDiagnosis.error_type) + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.errorTypeBadgeLargeText,
                    { color: getErrorTypeColor(selectedDiagnosis.error_type) },
                  ]}
                >
                  {getErrorTypeLabel(selectedDiagnosis.error_type)}
                </Text>
              </View>

              {/* Step by step */}
              {selectedDiagnosis.step_by_step && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>풀이 과정</Text>
                  <Text style={styles.modalSectionBody}>
                    {selectedDiagnosis.step_by_step}
                  </Text>
                </View>
              )}

              {/* Correction guidance */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>교정 안내</Text>
                <Text style={styles.modalSectionBody}>
                  {selectedDiagnosis.correction}
                </Text>
              </View>

              {/* Reasoning */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>오류 분석</Text>
                <Text style={styles.modalSectionBody}>
                  {selectedDiagnosis.reasoning}
                </Text>
              </View>

              {/* Visual explanation */}
              {selectedDiagnosis.visual_explanation && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>시각 설명</Text>
                  <VisualExplanationRenderer
                    visualExplanation={selectedDiagnosis.visual_explanation}
                  />
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
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

  // Analyzing state
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  analyzingTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  analyzingSubtext: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  refreshButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  refreshButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Error
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
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.white,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
  },

  // Info card
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  accuracyText: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Section
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },

  // Chart card
  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // Insights card
  insightsCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  insightsTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  insightRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  insightBullet: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  insightText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Diagnosis card
  diagCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  diagCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  questionNumberBadge: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  questionNumberText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  errorTypeBadge: {
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
  },
  errorTypeBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  diagReasoning: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  diagTapHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    textAlign: 'right',
  },

  // Perfect score
  perfectCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  perfectIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  perfectTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.accent,
  },

  // Error card
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  errorCardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.alert,
    marginBottom: SPACING.sm,
  },
  errorCardText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  miniTestButton: {
    minHeight: MIN_TOUCH_TARGET + 8,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTestButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  miniTestButtonText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  modalCloseButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalTitle: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    padding: SPACING.md,
  },
  errorTypeBadgeLarge: {
    alignSelf: 'flex-start',
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  errorTypeBadgeLargeText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
  },
  modalSection: {
    marginBottom: SPACING.lg,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalSectionBody: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
});
