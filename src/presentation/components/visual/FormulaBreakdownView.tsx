import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { FormulaBreakdownData } from '@/domain/value-objects';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '@/presentation/theme';
import { MathText } from './MathText';

interface Props {
  data: FormulaBreakdownData;
}

export function FormulaBreakdownView({ data }: Props) {
  const { lines, errorLineIndex, summary } = data;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {lines.map((line, idx) => {
        const isError = line.isError || idx === errorLineIndex;

        return (
          <React.Fragment key={idx}>
            {/* Arrow between cards */}
            {idx > 0 && (
              <View style={styles.connectorWrap}>
                <View style={styles.connectorLine} />
                <Text style={styles.arrow}>▼</Text>
              </View>
            )}

            {/* Formula card */}
            <View
              style={[
                styles.card,
                isError ? styles.cardError : styles.cardDefault,
              ]}
            >
              <MathText
                latex={line.latex}
                fontSize={FONT_SIZE.lg}
                color={isError ? '#9F1239' : COLORS.textPrimary}
              />
              <Text
                style={[
                  styles.annotation,
                  isError && styles.annotationError,
                ]}
              >
                {line.annotation}
              </Text>
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
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1.5,
  },
  cardDefault: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
  },
  cardError: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F43F5E',
    borderWidth: 2.5,
  },
  latex: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  latexError: {
    color: '#F43F5E',
  },
  annotation: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  annotationError: {
    color: '#F43F5E',
    fontWeight: '600',
  },
  connectorWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
  },
  arrow: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: -2,
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
