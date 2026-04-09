import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { VisualExplanation } from '@/domain/value-objects';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '@/presentation/theme';
import { SolutionFlowView } from './SolutionFlowView';
import { ComparisonView } from './ComparisonView';
import { FormulaBreakdownView } from './FormulaBreakdownView';

interface Props {
  visualExplanation: VisualExplanation | null;
}

export function VisualExplanationRenderer({ visualExplanation }: Props) {
  if (visualExplanation == null) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>텍스트 설명</Text>
      </View>
    );
  }

  switch (visualExplanation.type) {
    case 'flow':
      return <SolutionFlowView data={visualExplanation.data} />;
    case 'comparison':
      return <ComparisonView data={visualExplanation.data} />;
    case 'formula':
      return <FormulaBreakdownView data={visualExplanation.data} />;
    default: {
      // Exhaustive check
      const _exhaustive: never = visualExplanation;
      return null;
    }
  }
}

const styles = StyleSheet.create({
  fallback: {
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    margin: SPACING.md,
  },
  fallbackText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
});
