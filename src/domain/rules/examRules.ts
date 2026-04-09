import { ExamStatus } from '../value-objects/ExamStatus';
import { Exam } from '../entities/Exam';

const VALID_TRANSITIONS: Record<ExamStatus, ExamStatus[]> = {
  processing: ['ocr_done', 'error'],
  ocr_done: ['verified', 'error'],
  verified: ['analyzed', 'error'],
  analyzed: ['completed', 'error'],
  completed: [],
  error: ['processing', 'verified'], // retry (processing for OCR, verified for analysis)
};

export function canTransitionStatus(from: ExamStatus, to: ExamStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isExpired(exam: Exam): boolean {
  return new Date() > new Date(exam.expiresAt);
}

export function getExpiryDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
}
