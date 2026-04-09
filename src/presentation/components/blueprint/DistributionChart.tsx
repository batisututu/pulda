import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import {
  BORDER_RADIUS,
  COLORS,
  FONT_SIZE,
  SPACING,
} from '../../theme';

export interface DistributionChartProps {
  /** Section heading, e.g. "단원별 분포" */
  title: string;
  /** Key-value pairs where values are 0-1 proportions, e.g. { "함수": 0.4 } */
  data: Record<string, number>;
  /** Optional per-key bar colors */
  colorMap?: Record<string, string>;
}

const BAR_HEIGHT = 20;
const LABEL_WIDTH = 72;
const PERCENT_WIDTH = 44;

/**
 * Pure React Native horizontal bar chart.
 * Bars animate from 0 to their target width on mount.
 */
export function DistributionChart({
  title,
  data,
  colorMap,
}: DistributionChartProps) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {entries.map(([label, value]) => (
        <BarRow
          key={label}
          label={label}
          value={value}
          color={colorMap?.[label] ?? COLORS.primary}
        />
      ))}
    </View>
  );
}

interface BarRowProps {
  label: string;
  value: number;
  color: string;
}

function BarRow({ label, value, color }: BarRowProps) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: value,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim]);

  const percentage = `${Math.round(value * 100)}%`;

  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      <Text style={styles.percent}>{percentage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    width: LABEL_WIDTH,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: BAR_HEIGHT,
    backgroundColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm,
  },
  percent: {
    width: PERCENT_WIDTH,
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
});
