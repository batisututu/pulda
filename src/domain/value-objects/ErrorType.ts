/**
 * Math error types.
 * - concept_gap: Lack of conceptual understanding or formula misapplication
 * - calculation_error: Arithmetic/calculation/sign mistakes
 * - time_pressure: Ran out of time on harder problems
 */
export type MathErrorType = 'concept_gap' | 'calculation_error' | 'time_pressure';

/**
 * Korean (국어) error types.
 * - comprehension_error: Failed to grasp passage content
 * - grammar_error: Spelling, sentence structure, or grammar rule mistakes
 * - vocabulary_gap: Unknown words or Sino-Korean vocabulary
 * - interpretation_error: Misinterpreted literary work theme/intent
 * - time_pressure: Ran out of time
 */
export type KoreanErrorType = 'comprehension_error' | 'grammar_error' | 'vocabulary_gap' | 'interpretation_error' | 'time_pressure';

/**
 * English error types (listening excluded from MVP).
 * - grammar_error: Tense, agreement, articles, relative clauses
 * - vocabulary_gap: Word meaning or collocation errors
 * - comprehension_error: Failed to understand main idea or inference
 * - time_pressure: Ran out of time
 */
export type EnglishErrorType = 'grammar_error' | 'vocabulary_gap' | 'comprehension_error' | 'time_pressure';

/**
 * Union of all subject error types.
 * 7 unique values: concept_gap, calculation_error, time_pressure,
 * comprehension_error, grammar_error, vocabulary_gap, interpretation_error
 */
export type ErrorType =
  | MathErrorType
  | KoreanErrorType
  | EnglishErrorType;
