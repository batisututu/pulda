import { ErrorType } from '../value-objects/ErrorType';

/**
 * Normalize confidence value to [0.0, 1.0] range.
 * If value > 1, assume it is a percentage (divide by 100).
 */
export function normalizeConfidence(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0.5;
  let normalized = value;
  if (normalized > 1) {
    normalized = normalized / 100;
  }
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Determine confidence based on primary (Claude) and verifier (GPT) answers.
 * Match = high confidence, differ = low confidence.
 */
export function determineConfidence(
  primaryAnswer: string,
  verifierAnswer: string,
  baseConfidence: number
): number {
  const normalized1 = primaryAnswer.replace(/\s+/g, '').toLowerCase();
  const normalized2 = verifierAnswer.replace(/\s+/g, '').toLowerCase();
  const match = normalized1 === normalized2;
  const safeBase = normalizeConfidence(baseConfidence);
  return match ? safeBase : Math.min(safeBase, 0.5);
}

/** Error type display mapping for all 7 subject error types */
export const ERROR_TYPE_CONFIG: Record<ErrorType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}> = {
  // Math
  concept_gap: { label: '개념 부족', icon: 'book-open', color: '#F43F5E', bgColor: '#FFF1F2' },
  calculation_error: { label: '계산 실수', icon: 'pencil', color: '#F59E0B', bgColor: '#FFFBEB' },
  // Shared
  time_pressure: { label: '시간 부족', icon: 'clock', color: '#3B82F6', bgColor: '#EFF6FF' },
  // Korean & English
  comprehension_error: { label: '독해 오류', icon: 'eye', color: '#8B5CF6', bgColor: '#F5F3FF' },
  grammar_error: { label: '문법 오류', icon: 'spell-check', color: '#EC4899', bgColor: '#FDF2F8' },
  vocabulary_gap: { label: '어휘 부족', icon: 'book-text', color: '#14B8A6', bgColor: '#F0FDFA' },
  // Korean only
  interpretation_error: { label: '해석 오류', icon: 'lightbulb', color: '#F97316', bgColor: '#FFF7ED' },
};
