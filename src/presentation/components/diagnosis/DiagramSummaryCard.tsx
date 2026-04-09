import React from 'react';
import { View, Text } from 'react-native';
import type { VisualExplanation } from '@/domain/value-objects';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '@/presentation/theme';

interface DiagramSummaryCardProps {
  visualExplanation: VisualExplanation;
}

/** Extract summary and conceptKeywords from any VisualExplanation type */
function extractCommonFields(ve: VisualExplanation): {
  summary: string;
  conceptKeywords: string[];
  typeLabel: string;
} {
  const typeLabels: Record<string, string> = {
    flow: '풀이 흐름',
    comparison: '비교 분석',
    formula: '수식 분해',
  };
  return {
    summary: ve.data.summary,
    conceptKeywords: ve.data.conceptKeywords,
    typeLabel: typeLabels[ve.type] ?? ve.type,
  };
}

/**
 * Compact summary card showing the diagram's one-line summary,
 * diagram type badge, and concept keyword tags as pill badges.
 */
export function DiagramSummaryCard({ visualExplanation }: DiagramSummaryCardProps) {
  const { summary, conceptKeywords, typeLabel } = extractCommonFields(visualExplanation);

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: SPACING.md,
      }}
    >
      {/* Diagram type badge */}
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#EEF2FF',
          borderRadius: BORDER_RADIUS.pill,
          paddingHorizontal: SPACING.sm,
          paddingVertical: 2,
          marginBottom: SPACING.sm,
        }}
      >
        <Text style={{ fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.primary }}>
          {typeLabel}
        </Text>
      </View>

      {/* Summary text */}
      <Text
        style={{
          fontSize: FONT_SIZE.md,
          fontWeight: '600',
          color: COLORS.textPrimary,
          marginBottom: SPACING.sm,
        }}
      >
        {summary}
      </Text>

      {/* Concept keyword pills */}
      {conceptKeywords.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs }}>
          {conceptKeywords.map((keyword, i) => (
            <View
              key={i}
              style={{
                backgroundColor: '#F8FAFC',
                borderRadius: BORDER_RADIUS.pill,
                paddingHorizontal: SPACING.sm + 2,
                paddingVertical: SPACING.xs,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text
                style={{
                  fontSize: FONT_SIZE.xs,
                  fontWeight: '500',
                  color: COLORS.textSecondary,
                }}
              >
                {keyword}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
