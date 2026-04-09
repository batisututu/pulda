import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import { Button, Card, LoadingOverlay, ErrorBanner, Modal } from '@/presentation/components/common';
import { MathText } from '@/presentation/components/visual/MathText';
import { MathKeypad } from '@/presentation/components/solver';
import useMiniTestStore from '@/presentation/stores/useMiniTestStore';
import { predictScore } from '@/domain/rules/scoringRules';
import type { RecentTestRecord } from '@/domain/rules/scoringRules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Check if a string contains LaTeX-like patterns */
function hasLatex(text: string): boolean {
  return /\\[a-zA-Z]+|\\frac|\$.*\$|\\\(|\\\[/.test(text);
}

// ---------------------------------------------------------------------------
// Option Labels
// ---------------------------------------------------------------------------

const OPTION_LABELS = ['1', '2', '3', '4', '5'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SolveScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();

  const {
    currentTest,
    questions,
    answers,
    currentIndex,
    isLoading,
    result,
    error,
    loadTest,
    setAnswer,
    nextQuestion,
    prevQuestion,
    submitAnswers,
    resetTest,
  } = useMiniTestStore();

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // 로컬 타이머: 초당 ref를 증가시키고 표시용 state만 업데이트한다.
  // tick()을 스토어에서 제거하여 전체 구독자 리렌더링을 방지한다.
  const elapsedRef = useRef<number>(0);
  const [displayTime, setDisplayTime] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load test on mount
  useEffect(() => {
    if (testId) {
      loadTest(testId);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [testId, loadTest]);

  // 문제가 로드되면 타이머를 시작하고, 결과가 나오면 멈춘다.
  useEffect(() => {
    if (questions.length > 0 && !result && !currentTest?.completedAt) {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setDisplayTime(elapsedRef.current);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [questions.length, result, currentTest?.completedAt]);

  const currentQuestion = questions[currentIndex] ?? null;
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? '' : '';

  // Handlers
  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion) return;
      setAnswer(currentQuestion.id, String(optionIndex + 1));
    },
    [currentQuestion, setAnswer],
  );

  const handleTextAnswer = useCallback(
    (text: string) => {
      if (!currentQuestion) return;
      setAnswer(currentQuestion.id, text);
    },
    [currentQuestion, setAnswer],
  );

  const handleSubmitPress = useCallback(() => {
    setShowSubmitModal(true);
  }, []);

  const handleConfirmSubmit = useCallback(async () => {
    setShowSubmitModal(false);
    // 제출 시점의 누적 시간을 ref에서 읽어 스토어로 전달한다.
    await submitAnswers(elapsedRef.current);
  }, [submitAnswers]);

  const handleClose = useCallback(() => {
    resetTest();
    router.back();
  }, [resetTest]);

  const handleBackToExams = useCallback(() => {
    resetTest();
    router.replace('/(tabs)');
  }, [resetTest]);

  // -------------------------------------------------------------------------
  // Result View
  // -------------------------------------------------------------------------

  if (result) {
    // 현재 테스트 결과로 예측 레코드를 구성한다.
    // 오답 유형 분포는 questions 배열의 targetErrorType 필드에서 집계한다.
    const errorDistribution: RecentTestRecord['errorDistribution'] = {};
    for (const q of questions) {
      if (q.targetErrorType) {
        errorDistribution[q.targetErrorType] =
          (errorDistribution[q.targetErrorType] ?? 0) + 1;
      }
    }
    const accuracyRatio = result.total > 0 ? result.score / result.total : 0;
    const prediction = predictScore([{ accuracyRatio, errorDistribution }]);

    const trendLabel: Record<string, string> = {
      improving: '상승 추세',
      stable: '안정적',
      declining: '하락 추세',
    };
    const trendColor: Record<string, string> = {
      improving: COLORS.accent,
      stable: COLORS.primary,
      declining: COLORS.alert,
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.container} contentContainerStyle={styles.resultContent}>
          <Text style={styles.resultTitle}>테스트 결과</Text>

          <Card style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>점수</Text>
            <Text style={styles.scoreValue}>
              {result.score} / {result.total}
            </Text>
            <Text style={styles.timeLabel}>소요 시간: {formatTime(displayTime)}</Text>
          </Card>

          {/* 예측 점수 범위 카드 — Premium 전용 기능 */}
          <View style={styles.predictionCard}>
            <View style={styles.predictionHeader}>
              <Text style={styles.predictionTitle}>예측 점수 범위</Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>PREMIUM</Text>
              </View>
            </View>
            <Text style={styles.predictionRange}>
              {prediction.min}점 ~ {prediction.max}점
            </Text>
            <Text style={[styles.predictionTrend, { color: trendColor[prediction.trend] }]}>
              {trendLabel[prediction.trend]}
            </Text>
            <Text style={styles.predictionNote}>
              * 이 예측은 현재 테스트 1회 기록 기준입니다. 더 많은 테스트를 완료할수록 정확도가 높아집니다.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>문제별 결과</Text>

          {questions.map((q, idx) => {
            const answerResult = result.answers.find(
              (a) => a.variantQuestionId === q.id,
            );
            const isCorrect = answerResult?.isCorrect;
            const mark = isCorrect === true ? 'O' : isCorrect === false ? 'X' : '-';
            const markColor =
              isCorrect === true
                ? COLORS.accent
                : isCorrect === false
                  ? COLORS.alert
                  : COLORS.textTertiary;

            return (
              <Card key={q.id} style={styles.resultQuestionCard}>
                <View style={styles.resultQuestionHeader}>
                  <Text style={styles.resultQuestionNumber}>
                    문제 {idx + 1}
                  </Text>
                  <Text style={[styles.resultMark, { color: markColor }]}>
                    {mark}
                  </Text>
                </View>
                <Text style={styles.resultAnswerText} numberOfLines={2}>
                  내 답: {answerResult?.userAnswer || '미응답'}
                </Text>
                <Text style={styles.resultCorrectText} numberOfLines={2}>
                  정답: {q.answer}
                </Text>
              </Card>
            );
          })}

          <View style={styles.resultActions}>
            <Button
              title="시험 목록으로"
              onPress={handleBackToExams}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------------------
  // Solving View
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay visible={isLoading} message="로딩 중..." />

      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.questionProgress}>
          문제 {totalQuestions > 0 ? currentIndex + 1 : 0}/{totalQuestions}
        </Text>
        <Text style={styles.timer}>{formatTime(displayTime)}</Text>
        <TouchableOpacity
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text style={styles.closeButton}>X</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <ErrorBanner message={error} />
      ) : null}

      {/* Question Area */}
      {currentQuestion ? (
        <ScrollView
          style={styles.questionScroll}
          contentContainerStyle={styles.questionScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question Content */}
          <Card style={styles.questionCard}>
            {hasLatex(currentQuestion.content) ? (
              <MathText
                latex={currentQuestion.content}
                fontSize={FONT_SIZE.md}
                color={COLORS.textPrimary}
              />
            ) : (
              <Text style={styles.questionContent}>
                {currentQuestion.content}
              </Text>
            )}
          </Card>

          {/* Answer Section */}
          {currentQuestion.questionType === 'multiple_choice' &&
          currentQuestion.options ? (
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, idx) => {
                const isSelected = currentAnswer === String(idx + 1);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.optionButton,
                      isSelected && styles.optionButtonSelected,
                    ]}
                    onPress={() => handleSelectOption(idx)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.optionNumber,
                        isSelected && styles.optionNumberSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionNumberText,
                          isSelected && styles.optionNumberTextSelected,
                        ]}
                      >
                        {OPTION_LABELS[idx]}
                      </Text>
                    </View>
                    {hasLatex(option) ? (
                      <View style={styles.optionTextWrap}>
                        <MathText
                          latex={option}
                          fontSize={FONT_SIZE.sm}
                          color={isSelected ? COLORS.primary : COLORS.textPrimary}
                        />
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                        numberOfLines={3}
                      >
                        {option}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            // short_answer 문제: 수학 키패드로 LaTeX 수식 입력
            // key 를 문제 ID 로 지정하여 문제 전환 시 키패드 상태를 초기화
            <View style={styles.inputContainer}>
              <MathKeypad
                key={currentQuestion.id}
                initialValue={currentAnswer}
                onSubmit={handleTextAnswer}
              />
            </View>
          )}
        </ScrollView>
      ) : !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>문제가 없습니다.</Text>
        </View>
      ) : null}

      {/* Bottom Navigation */}
      {totalQuestions > 0 ? (
        <View style={styles.bottomBar}>
          <Button
            title="이전"
            onPress={prevQuestion}
            variant="outline"
            size="md"
            disabled={currentIndex === 0}
          />
          {isLastQuestion ? (
            <Button
              title="제출"
              onPress={handleSubmitPress}
              variant="primary"
              size="md"
            />
          ) : (
            <Button
              title="다음"
              onPress={nextQuestion}
              variant="primary"
              size="md"
            />
          )}
        </View>
      ) : null}

      {/* Submit Confirmation Modal */}
      <Modal
        visible={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="제출 확인"
      >
        <Text style={styles.modalText}>
          총 {totalQuestions}문제 중 {answeredCount}문제 답변됨.{'\n'}
          제출하시겠습니까?
        </Text>
        {answeredCount < totalQuestions ? (
          <Text style={styles.modalWarning}>
            미응답 문제가 {totalQuestions - answeredCount}개 있습니다.
          </Text>
        ) : null}
        <View style={styles.modalActions}>
          <Button
            title="취소"
            onPress={() => setShowSubmitModal(false)}
            variant="outline"
            size="md"
          />
          <View style={styles.modalSpacer} />
          <Button
            title="제출"
            onPress={handleConfirmSubmit}
            variant="primary"
            size="md"
          />
        </View>
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
  container: {
    flex: 1,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  questionProgress: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  timer: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.primary,
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textTertiary,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    textAlign: 'center',
    lineHeight: MIN_TOUCH_TARGET,
  },

  // Question Area
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  questionCard: {
    marginBottom: SPACING.md,
  },
  questionContent: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },

  // Options (Multiple Choice)
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  optionButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  optionNumber: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  optionNumberSelected: {
    backgroundColor: COLORS.primary,
  },
  optionNumberText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  optionNumberTextSelected: {
    color: COLORS.white,
  },
  optionText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  optionTextWrap: {
    flex: 1,
  },

  // short_answer 입력 컨테이너 (MathKeypad 를 감싸는 래퍼)
  inputContainer: {
    marginTop: SPACING.sm,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },

  // Submit Modal
  modalText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  modalWarning: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.alert,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  modalSpacer: {
    width: SPACING.sm,
  },

  // Result View
  resultContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  resultTitle: {
    fontSize: FONT_SIZE.title,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  scoreCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  scoreLabel: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  timeLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textTertiary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  resultQuestionCard: {
    marginBottom: SPACING.sm,
  },
  resultQuestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  resultQuestionNumber: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  resultMark: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
  },
  resultAnswerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  resultCorrectText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.accent,
  },
  resultActions: {
    marginTop: SPACING.lg,
  },

  // 예측 점수 카드
  predictionCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  predictionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  // Premium 배지: 서비스 스펙에 따라 score prediction은 Premium 전용 기능
  premiumBadge: {
    backgroundColor: COLORS.secondary,
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  predictionRange: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  predictionTrend: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  predictionNote: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
});
