import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { ComparisonData, ComparisonStep } from '@/domain/value-objects';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '@/presentation/theme';
import { MathText } from './MathText';

interface Props {
  data: ComparisonData;
}

// ── Step Card ────────────────────────────────────────────────

function StepCard({
  step,
  isError,
}: {
  step: ComparisonStep;
  isError: boolean;
}) {
  const bg = isError ? '#FFF1F2' : '#ECFDF5';
  const border = isError ? '#F43F5E' : '#10B981';

  return (
    <View style={[styles.stepCard, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.stepLabel, { color: border }]}>{step.label}</Text>
      {step.latex != null && <MathText latex={step.latex} fontSize={FONT_SIZE.sm} />}
      {step.annotation != null && (
        <Text style={styles.annotation}>{step.annotation}</Text>
      )}
    </View>
  );
}

// ── Component ────────────────────────────────────────────────

export function ComparisonView({ data }: Props) {
  const { studentSteps, correctSteps, divergeIndex, summary } = data;
  const maxLen = Math.max(studentSteps.length, correctSteps.length);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Column headers */}
      <View style={styles.row}>
        <View style={styles.colHeader}>
          <Text style={styles.headerText}>학생 풀이</Text>
        </View>
        <View style={styles.colHeader}>
          <Text style={styles.headerText}>정답 풀이</Text>
        </View>
      </View>

      {Array.from({ length: maxLen }).map((_, idx) => {
        const student = studentSteps[idx] as ComparisonStep | undefined;
        const correct = correctSteps[idx] as ComparisonStep | undefined;
        const isDiverged = idx >= divergeIndex;

        return (
          <React.Fragment key={idx}>
            {/* Diverge divider */}
            {idx === divergeIndex && (
              <View style={styles.dividerWrap}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>여기서 달라짐</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            <View style={styles.row}>
              {/* Student side */}
              <View style={styles.col}>
                {student != null ? (
                  <StepCard step={student} isError={isDiverged} />
                ) : (
                  <View style={styles.emptyCell} />
                )}
              </View>

              {/* Correct side */}
              <View style={styles.col}>
                {correct != null ? (
                  <StepCard step={correct} isError={false} />
                ) : (
                  <View style={styles.emptyCell} />
                )}
              </View>
            </View>
          </React.Fragment>
        );
      })}

      {/* Summary */}
      {summary.length > 0 && (
        <Text style={styles.summary}>{summary}</Text>
      )}
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  col: {
    flex: 1,
  },
  colHeader: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: SPACING.sm,
  },
  headerText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stepCard: {
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  stepLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  latex: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  annotation: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  emptyCell: {
    minHeight: 40,
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: COLORS.alert,
  },
  dividerLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.alert,
  },
  summary: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
});
