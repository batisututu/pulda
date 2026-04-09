import type { QuestionType } from '../value-objects/QuestionType';
import type { SubjectOrOther } from '../value-objects/Subject';

/**
 * An individual question within an exam, with student answer and correctness.
 * Math content uses LaTeX; Korean/English content is plain text with optional LaTeX.
 */
export interface Question {
  id: string;
  examId: string;
  subject: SubjectOrOther;
  number: number;
  content: string;              // LaTeX (math) or plain text (korean/english)
  questionType: QuestionType;
  options: string[] | null;     // 5 options for multiple choice
  answer: string | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  points: number | null;
  createdAt: string;            // ISO 8601
}
