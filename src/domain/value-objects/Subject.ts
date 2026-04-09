/**
 * Subject types for AI-analyzed exams (Tier 1).
 */
export type Subject = 'math' | 'korean' | 'english';

/**
 * All subject types including "other" for digitization-only (Tier 2).
 */
export type SubjectOrOther = Subject | 'other';

/**
 * Service tier determines the pipeline depth.
 * - ai_analysis: Full L1-L4 pipeline (Tier 1 subjects)
 * - digitization: OCR only, student self-scores (Tier 2)
 */
export type ServiceTier = 'ai_analysis' | 'digitization';
