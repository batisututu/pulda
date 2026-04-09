import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const HEIGHT: Record<ButtonSize, number> = {
  sm: MIN_TOUCH_TARGET,
  md: 48,
  lg: 56,
};

const PADDING_H: Record<ButtonSize, number> = {
  sm: SPACING.md,
  md: SPACING.lg,
  lg: SPACING.xl,
};

const TEXT_SIZE: Record<ButtonSize, number> = {
  sm: FONT_SIZE.sm,
  md: FONT_SIZE.md,
  lg: FONT_SIZE.lg,
};

function getContainerStyle(variant: ButtonVariant, size: ButtonSize, disabled: boolean, fullWidth: boolean): ViewStyle {
  const base: ViewStyle = {
    minHeight: HEIGHT[size],
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: PADDING_H[size],
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  };

  if (fullWidth) {
    base.width = '100%';
  }

  if (disabled) {
    switch (variant) {
      case 'primary':
      case 'secondary':
        return { ...base, backgroundColor: COLORS.disabled };
      case 'outline':
        return { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.disabled };
      case 'ghost':
        return { ...base, backgroundColor: 'transparent' };
    }
  }

  switch (variant) {
    case 'primary':
      return { ...base, backgroundColor: COLORS.primary };
    case 'secondary':
      return { ...base, backgroundColor: COLORS.secondary };
    case 'outline':
      return { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary };
    case 'ghost':
      return { ...base, backgroundColor: 'transparent' };
  }
}

function getTextStyle(variant: ButtonVariant, size: ButtonSize, disabled: boolean): TextStyle {
  const base: TextStyle = {
    fontSize: TEXT_SIZE[size],
    fontWeight: '600',
  };

  if (disabled) {
    return { ...base, color: COLORS.textTertiary };
  }

  switch (variant) {
    case 'primary':
    case 'secondary':
      return { ...base, color: COLORS.white };
    case 'outline':
    case 'ghost':
      return { ...base, color: COLORS.primary };
  }
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const containerStyle = getContainerStyle(variant, size, isDisabled, fullWidth);
  const textStyle = getTextStyle(variant, size, isDisabled);

  const indicatorColor = (variant === 'outline' || variant === 'ghost')
    ? COLORS.primary
    : COLORS.white;

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={indicatorColor}
          style={styles.indicator}
        />
      ) : null}
      <Text style={textStyle}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  indicator: {
    marginRight: SPACING.sm,
  },
});
