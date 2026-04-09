import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

interface FaqItem {
  question: string;
  answer: string;
  /** Optional email link to render as a tappable link */
  email?: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: '풀다는 어떤 앱인가요?',
    answer:
      '풀다(StudyAI)는 AI 기반 시험 분석 앱입니다. 시험지를 촬영하면 AI가 자동으로 문항을 추출하고, 오답을 분석하여 맞춤형 연습 문제를 생성합니다.',
  },
  {
    question: '시험지를 어떻게 업로드하나요?',
    answer:
      "하단 탭의 '업로드' 버튼을 눌러 카메라로 촬영하거나 갤러리에서 시험지 사진을 선택하세요. 과목을 선택한 후 '분석 시작' 버튼을 누르면 AI 분석이 시작됩니다.",
  },
  {
    question: 'AI 분석은 어떻게 진행되나요?',
    answer:
      '4단계 AI 파이프라인으로 진행됩니다: (1) OCR로 문항 추출 → (2) 교육과정 분류 → (3) 오답 원인 진단 → (4) 맞춤 변형문항 생성. 분석에는 약 30초~1분이 소요됩니다.',
  },
  {
    question: '미니테스트란 무엇인가요?',
    answer:
      '오답 진단을 기반으로 생성된 변형문항으로 구성된 연습 테스트입니다. 약점을 집중적으로 연습할 수 있으며, 타이머와 함께 풀이할 수 있습니다.',
  },
  {
    question: '크레딧은 어떻게 사용되나요?',
    answer:
      '시험지 1장 분석에 1크레딧이 소요됩니다. 무료 플랜은 월 30크레딧, Standard는 150크레딧, Premium은 400크레딧이 제공됩니다. 매월 자동으로 리셋됩니다.',
  },
  {
    question: '학부모 연동은 어떻게 하나요?',
    answer:
      '학생이 마이페이지에서 링크 코드를 생성하면, 학부모가 해당 코드를 입력하여 연동할 수 있습니다. 연동 후 학부모는 자녀의 학습 현황을 대시보드에서 확인할 수 있습니다.',
  },
  {
    question: '문의/피드백',
    answer:
      '서비스 이용 중 문제가 발생하거나 개선 의견이 있으시면 pulda.help@gmail.com으로 연락해주세요.',
    email: 'pulda.help@gmail.com',
  },
];

// ---------------------------------------------------------------------------
// FAQ Accordion Item
// ---------------------------------------------------------------------------

interface FaqAccordionProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}

function FaqAccordionItem({ item, isOpen, onToggle }: FaqAccordionProps) {
  const handleEmailPress = useCallback(() => {
    if (item.email) {
      Linking.openURL(`mailto:${item.email}`);
    }
  }, [item.email]);

  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqHeader}
        onPress={onToggle}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.faqArrow}>{isOpen ? '\u25BC' : '\u25B6'}</Text>
        <Text style={styles.faqQuestion}>{item.question}</Text>
      </TouchableOpacity>

      {isOpen ? (
        <View style={styles.faqBody}>
          <Text style={styles.faqAnswer}>{item.answer}</Text>
          {item.email ? (
            <TouchableOpacity onPress={handleEmailPress} activeOpacity={0.6}>
              <Text style={styles.emailLink}>{item.email}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HelpScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>도움말</Text>
        {/* Spacer for centering */}
        <View style={styles.headerSpacer} />
      </View>

      {/* FAQ List */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <View style={styles.faqList}>
          {FAQ_DATA.map((item, index) => (
            <FaqAccordionItem
              key={index}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>풀다 v1.0.0</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: FONT_SIZE.xl,
    color: COLORS.textPrimary,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: MIN_TOUCH_TARGET,
  },

  // Content
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // FAQ List
  faqList: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  faqArrow: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginRight: SPACING.sm,
    width: 16,
  },
  faqQuestion: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // FAQ Body
  faqBody: {
    paddingHorizontal: SPACING.md,
    paddingLeft: SPACING.md + 16 + SPACING.sm, // align with question text
    paddingBottom: SPACING.md,
  },
  faqAnswer: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    lineHeight: FONT_SIZE.sm * 1.6,
  },
  emailLink: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.sm,
    textDecorationLine: 'underline',
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: SPACING.xl,
  },
});
