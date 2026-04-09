import { filterForParent, FullStudentData } from '@/domain/rules/parentPrivacyRules';

describe('filterForParent', () => {
  const sampleData: FullStudentData = {
    // Hidden from parent
    exams: [{ id: 'exam-1' }, { id: 'exam-2' }],
    individualAnswers: [{ questionId: 'q1', answer: '3' }],
    socialActivity: [{ type: 'follow', targetId: 'u2' }],
    // Visible to parent
    weeklyStats: { questionsSolved: 42, studyTime: 3600, loginDays: 5 },
    testScores: [
      { date: '2026-02-15', score: 85, total: 100 },
      { date: '2026-02-20', score: 92, total: 100 },
    ],
    weaknessHeatmap: [
      { unit: 'quadratic equations', proportion: 0.4, questionCount: 10 },
    ],
    errorDistribution: [
      { type: 'concept_gap', count: 5 },
      { type: 'calculation_error', count: 3 },
    ],
  };

  it('returns an object with exactly 4 keys', () => {
    const result = filterForParent(sampleData);
    expect(Object.keys(result)).toHaveLength(4);
  });

  it('includes weeklyStats, testScores, weaknessHeatmap, errorDistribution', () => {
    const result = filterForParent(sampleData);
    expect(result).toHaveProperty('weeklyStats');
    expect(result).toHaveProperty('testScores');
    expect(result).toHaveProperty('weaknessHeatmap');
    expect(result).toHaveProperty('errorDistribution');
  });

  it('does NOT include exams, individualAnswers, or socialActivity', () => {
    const result = filterForParent(sampleData);
    expect(result).not.toHaveProperty('exams');
    expect(result).not.toHaveProperty('individualAnswers');
    expect(result).not.toHaveProperty('socialActivity');
  });

  it('passes through weeklyStats unchanged', () => {
    const result = filterForParent(sampleData);
    expect(result.weeklyStats).toEqual(sampleData.weeklyStats);
  });

  it('passes through testScores unchanged', () => {
    const result = filterForParent(sampleData);
    expect(result.testScores).toEqual(sampleData.testScores);
  });

  it('passes through weaknessHeatmap unchanged', () => {
    const result = filterForParent(sampleData);
    expect(result.weaknessHeatmap).toEqual(sampleData.weaknessHeatmap);
  });

  it('passes through errorDistribution unchanged', () => {
    const result = filterForParent(sampleData);
    expect(result.errorDistribution).toEqual(sampleData.errorDistribution);
  });
});
