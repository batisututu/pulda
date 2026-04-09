/**
 * Parent CAN see: aggregate stats, mini test scores, weakness heatmap, error type distribution
 * Parent CANNOT see: original exam images, individual answers, social activity
 */

export interface ParentVisibleData {
  weeklyStats: { questionsSolved: number; studyTime: number; loginDays: number };
  testScores: { date: string; score: number; total: number }[];
  weaknessHeatmap: { unit: string; proportion: number; questionCount: number }[];
  errorDistribution: { type: string; count: number }[];
}

export interface FullStudentData {
  exams: unknown[];           // HIDDEN from parent
  individualAnswers: unknown[]; // HIDDEN from parent
  socialActivity: unknown[];   // HIDDEN from parent
  weeklyStats: ParentVisibleData['weeklyStats'];
  testScores: ParentVisibleData['testScores'];
  weaknessHeatmap: ParentVisibleData['weaknessHeatmap'];
  errorDistribution: ParentVisibleData['errorDistribution'];
}

export function filterForParent(data: FullStudentData): ParentVisibleData {
  return {
    weeklyStats: data.weeklyStats,
    testScores: data.testScores,
    weaknessHeatmap: data.weaknessHeatmap,
    errorDistribution: data.errorDistribution,
  };
}
