/**
 * A student's answer to a single variant question within a mini test.
 */
export interface MiniTestAnswer {
  id: string;
  testId: string;
  variantQuestionId: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  timeSpent: number | null;       // seconds
  createdAt: string;              // ISO 8601
}
