/**
 * 풀다 (StudyAI) 브랜드 디자인 토큰
 */

export const COLORS = {
  // Brand
  primary: '#4F46E5',      // Deep Indigo
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  secondary: '#F97316',    // Coral Orange
  accent: '#10B981',       // Emerald Green
  alert: '#F43F5E',        // Rose Red

  // Error types
  conceptGap: '#F43F5E',        // Rose
  calculationError: '#F59E0B',  // Amber
  timePressure: '#3B82F6',      // Blue

  // Neutral
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  disabled: '#D1D5DB',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
} as const;

export const BORDER_RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 24,
  full: 9999,
} as const;

/** 최소 터치 타겟: 44x44px (iOS HIG) */
export const MIN_TOUCH_TARGET = 44;
