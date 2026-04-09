/**
 * Lifecycle status of an uploaded exam paper.
 * - processing: AI pipeline in progress
 * - ocr_done: OCR finished, awaiting user verification
 * - verified: User verified the OCR results
 * - analyzed: All analysis complete
 * - completed: Variant generation done, ready for mini-test
 * - error: Pipeline error occurred (can retry)
 */
export type ExamStatus =
  | 'processing'
  | 'ocr_done'
  | 'verified'
  | 'analyzed'
  | 'completed'
  | 'error';
