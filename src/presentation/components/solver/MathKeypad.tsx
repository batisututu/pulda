import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, MIN_TOUCH_TARGET } from '@/presentation/theme';
import { MathText } from '@/presentation/components/visual/MathText';
import { appendChar, insertTemplate, toggleSign, smartBackspace } from './latexBuilder';

// ---------------------------------------------------------------------------
// 로컬 상수 (테마에 없는 컴포넌트 전용 색상)
// ---------------------------------------------------------------------------

/** 연산자 버튼 배경 (라이트 인디고) */
const COLOR_OPERATOR_BG = '#EEF2FF';
/** 특수 기능 버튼 배경 (라이트 퍼플) */
const COLOR_SPECIAL_BG = '#F5F3FF';
/** 백스페이스 버튼 배경 (라이트 레드) */
const COLOR_BACKSPACE_BG = '#FEF2F2';
/** LaTeX 미리보기 영역 배경 */
const COLOR_PREVIEW_BG = '#F3F4F6';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

type ButtonType = 'digit' | 'operator' | 'special' | 'action' | 'backspace' | 'confirm';

interface KeypadButton {
  /** 버튼에 표시될 레이블 */
  label: string;
  /** 버튼 동작 유형 */
  type: ButtonType;
  /** 직접 수식에 추가할 LaTeX 문자열 (appendChar 사용) */
  latex?: string;
  /** 구조 템플릿 (insertTemplate 사용, 예: \\sqrt{}) */
  template?: string;
}

export interface MathKeypadProps {
  /** 초기 LaTeX 문자열 */
  initialValue?: string;
  /** 확인 버튼 콜백 */
  onSubmit: (latex: string) => void;
  /** 취소 콜백 */
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// 키패드 레이아웃 정의 (4행 × 6열)
// ---------------------------------------------------------------------------

const KEYPAD_ROWS: KeypadButton[][] = [
  [
    { label: '7', type: 'digit' },
    { label: '8', type: 'digit' },
    { label: '9', type: 'digit' },
    { label: '÷', type: 'operator', latex: '\\div ' },
    { label: 'x²', type: 'special', latex: '^{2}' },
    { label: '√', type: 'special', template: '\\sqrt{}' },
  ],
  [
    { label: '4', type: 'digit' },
    { label: '5', type: 'digit' },
    { label: '6', type: 'digit' },
    { label: '×', type: 'operator', latex: '\\times ' },
    { label: 'xⁿ', type: 'special', template: '^{}' },
    { label: '⅟', type: 'special', template: '\\frac{}{}' },
  ],
  [
    { label: '1', type: 'digit' },
    { label: '2', type: 'digit' },
    { label: '3', type: 'digit' },
    { label: '−', type: 'operator', latex: '-' },
    { label: '(', type: 'operator', latex: '(' },
    { label: ')', type: 'operator', latex: ')' },
  ],
  [
    { label: '0', type: 'digit' },
    { label: '.', type: 'digit' },
    { label: '±', type: 'action' },
    { label: '+', type: 'operator', latex: '+' },
    { label: '⌫', type: 'backspace' },
    { label: '확인', type: 'confirm' },
  ],
];

// ---------------------------------------------------------------------------
// 버튼 스타일 헬퍼
// ---------------------------------------------------------------------------

function getButtonBg(type: ButtonType): string {
  switch (type) {
    case 'operator':
      return COLOR_OPERATOR_BG;
    case 'special':
      return COLOR_SPECIAL_BG;
    case 'backspace':
      return COLOR_BACKSPACE_BG;
    case 'confirm':
      return COLORS.primary;
    default:
      // digit, action
      return COLORS.surface;
  }
}

function getButtonTextColor(type: ButtonType): string {
  if (type === 'confirm') return COLORS.white;
  return COLORS.textPrimary;
}

function getButtonFontSize(type: ButtonType): number {
  switch (type) {
    case 'digit':
    case 'action':
      return FONT_SIZE.xl;  // 20px
    case 'operator':
    case 'backspace':
      return 18;
    case 'special':
    case 'confirm':
      return FONT_SIZE.md;  // 15px (≈ 16px 기준)
  }
}

// ---------------------------------------------------------------------------
// 컴포넌트
// ---------------------------------------------------------------------------

export default function MathKeypad({ initialValue = '', onSubmit, onCancel }: MathKeypadProps) {
  const [expr, setExpr] = useState<string>(initialValue);

  // onSubmit 호출 시 setExpr 비동기 특성으로 인한 오래된 클로저 방지
  const exprRef = useRef<string>(initialValue);
  useEffect(() => {
    exprRef.current = expr;
  }, [expr]);

  const handleButtonPress = useCallback((button: KeypadButton) => {
    if (button.type === 'confirm') {
      // exprRef 를 통해 최신 수식 문자열 전달
      onSubmit(exprRef.current);
      return;
    }

    setExpr(prev => {
      switch (button.type) {
        case 'digit':
          // 숫자, 소수점: 레이블을 그대로 추가
          return appendChar(prev, button.label);

        case 'operator':
          // +, -, (, ) 등: latex 필드 사용
          return appendChar(prev, button.latex ?? button.label);

        case 'special':
          if (button.template) {
            // 구조 템플릿 삽입 (\\sqrt{}, ^{}, \\frac{}{})
            return insertTemplate(prev, button.template);
          }
          // 템플릿 없는 특수 버튼 (x²: ^{2} 를 직접 추가)
          return appendChar(prev, button.latex ?? button.label);

        case 'action':
          // ± 부호 토글
          return toggleSign(prev);

        case 'backspace':
          // 스마트 백스페이스
          return smartBackspace(prev);

        default:
          return prev;
      }
    });
  }, [onSubmit]);

  // 미리보기 영역: 수식이 없으면 플레이스홀더 표시
  const previewIsEmpty = expr.length === 0;

  return (
    <View style={styles.container}>
      {/* LaTeX 미리보기 */}
      <View style={styles.preview}>
        {previewIsEmpty ? (
          <Text style={styles.previewPlaceholder}>수식을 입력하세요</Text>
        ) : (
          <MathText
            latex={expr}
            fontSize={FONT_SIZE.xl}
            color={COLORS.textPrimary}
          />
        )}
      </View>

      {/* 키패드 그리드 */}
      <View style={styles.grid}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((button) => (
              <KeypadButtonCell
                key={button.label}
                button={button}
                onPress={handleButtonPress}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 개별 키패드 버튼 서브 컴포넌트
// ---------------------------------------------------------------------------

interface KeypadButtonCellProps {
  button: KeypadButton;
  onPress: (button: KeypadButton) => void;
}

function KeypadButtonCell({ button, onPress }: KeypadButtonCellProps) {
  const bgColor = getButtonBg(button.type);
  const textColor = getButtonTextColor(button.type);
  const fontSize = getButtonFontSize(button.type);

  const containerStyle: ViewStyle = {
    flex: 1,
    margin: 2,
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    backgroundColor: bgColor,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={() => onPress(button)}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={button.label}
    >
      <Text style={{ fontSize, color: textColor, fontWeight: '500' }}>
        {button.label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// 스타일
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },

  // LaTeX 미리보기 영역
  preview: {
    backgroundColor: COLOR_PREVIEW_BG,
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  previewPlaceholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textTertiary,
  },

  // 키패드 그리드
  grid: {
    padding: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
});
