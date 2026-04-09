import type { ClassificationResult } from './Blueprint';
import type { ExplanationResult } from './ErrorDiagnosis';

/**
 * Cache entry for previously analyzed questions.
 * Keyed by SHA-256 hash of normalized question text to avoid
 * redundant AI pipeline calls.
 */
export interface QuestionCache {
  id: string;
  contentHash: string;            // SHA-256 of normalized question text
  classification: ClassificationResult | null;
  explanation: ExplanationResult | null;
  hitCount: number;
  createdAt: string;              // ISO 8601
  updatedAt: string;              // ISO 8601
}
