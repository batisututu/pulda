import type { Difficulty } from '../value-objects/Difficulty';
import type { QuestionType } from '../value-objects/QuestionType';

/**
 * Classification result from the L2 AI pipeline stage.
 */
export interface ClassificationResult {
  questionId: string;
  subject: string;
  unit: string;                 // e.g., "이차함수"
  subUnit: string;              // e.g., "꼭짓점과 축"
  difficulty: Difficulty;
  questionType: QuestionType;
  reasoning: string;            // Korean
}

/**
 * Exam analysis blueprint containing distribution insights.
 * Generated after classifying all questions in an exam.
 */
export interface Blueprint {
  id: string;
  examId: string;
  unitDistribution: Record<string, number>;         // { "함수": 0.4, "확률과통계": 0.25, ... }
  typeDistribution: Record<string, number>;          // { "multiple_choice": 0.75, ... }
  difficultyDistribution: Record<string, number>;    // { "easy": 0.3, "medium": 0.45, ... }
  insights: string[] | null;                         // Korean insight sentences
  createdAt: string;                                 // ISO 8601
}
