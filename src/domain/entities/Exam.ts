import type { ExamStatus } from '../value-objects/ExamStatus';
import type { QuestionType } from '../value-objects/QuestionType';
import type { SubjectOrOther, ServiceTier } from '../value-objects/Subject';

/**
 * A single question extracted by OCR from an exam image.
 */
export interface OcrQuestion {
  number: number;
  content: string;            // LaTeX
  type: QuestionType;
  options: string[] | null;
  answer: string | null;
  points: number | null;
  needsReview: boolean;
  ocrConfidence: number;      // 문항별 OCR 인식 정확도 (0.0~1.0)
}

/**
 * 시험지에서 자동 감지된 메타데이터
 */
export interface ExamInfo {
  detectedSubject: string;
  detectedGrade: string | null;
  examType: string;
}

/**
 * Complete OCR pipeline output for an exam image.
 */
export interface OcrResult {
  questions: OcrQuestion[];
  metadata: {
    totalQuestions: number;
    pageNumber: number;
    confidence: number;
  };
  examInfo: ExamInfo;
}

/**
 * An uploaded exam paper that progresses through the AI pipeline.
 * Exams expire 7 days after creation by default.
 */
export interface Exam {
  id: string;
  userId: string;
  subject: SubjectOrOther;
  serviceTier: ServiceTier;
  imageUrl: string | null;
  ocrResult: OcrResult | null;
  status: ExamStatus;
  createdAt: string;          // ISO 8601
  expiresAt: string;          // ISO 8601, default: now + 7 days
}
