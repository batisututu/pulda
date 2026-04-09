import React from 'react';
import { Text, StyleSheet, Platform } from 'react-native';
import { FONT_SIZE, COLORS } from '@/presentation/theme';

// Try to import react-native-math-view; fallback to monospace Text if unavailable
let MathViewComponent: React.ComponentType<{ math: string; style?: object }> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MathViewComponent = require('react-native-math-view').default;
} catch {
  MathViewComponent = null;
}

interface MathTextProps {
  /** LaTeX string to render */
  latex: string;
  /** Font size override (default: FONT_SIZE.sm) */
  fontSize?: number;
  /** Text color override (default: COLORS.textSecondary) */
  color?: string;
}

/**
 * Renders a LaTeX string using react-native-math-view if available,
 * otherwise falls back to monospace Text display.
 */
export function MathText({ latex, fontSize = FONT_SIZE.sm, color = COLORS.textSecondary }: MathTextProps) {
  if (MathViewComponent) {
    return (
      <MathViewComponent
        math={latex}
        style={{ color, fontSize: fontSize + 2 }}
      />
    );
  }

  // Fallback: monospace text
  return (
    <Text style={[styles.fallback, { fontSize, color }]}>
      {latex}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallback: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
