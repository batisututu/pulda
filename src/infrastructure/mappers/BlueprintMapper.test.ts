import { toDomain, toPersistence } from '@/infrastructure/mappers/BlueprintMapper';
import type { BlueprintRow } from '@/infrastructure/mappers/BlueprintMapper';

describe('BlueprintMapper', () => {
  const createdAt = new Date().toISOString();

  // 모든 필드가 채워진 기준 row
  const fullRow: BlueprintRow = {
    id: 'bp-1',
    exam_id: 'exam-1',
    unit_distribution: { '이차함수': 0.4, '확률과통계': 0.25 },
    type_distribution: { 'multiple_choice': 0.75, 'short_answer': 0.25 },
    difficulty_distribution: { 'easy': 0.3, 'medium': 0.45, 'hard': 0.25 },
    insights: ['수학 II 단원 집중 출제', '최근 3개년 출제 비중 증가'],
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('bp-1');
      expect(result.examId).toBe('exam-1');
      expect(result.unitDistribution).toEqual({ '이차함수': 0.4, '확률과통계': 0.25 });
      expect(result.typeDistribution).toEqual({ 'multiple_choice': 0.75, 'short_answer': 0.25 });
      expect(result.difficultyDistribution).toEqual({ 'easy': 0.3, 'medium': 0.45, 'hard': 0.25 });
      expect(result.insights).toEqual(['수학 II 단원 집중 출제', '최근 3개년 출제 비중 증가']);
      expect(result.createdAt).toBe(createdAt);
    });

    it('preserves null insights', () => {
      // insights가 null인 경우 도메인에도 null로 전달되어야 함
      const result = toDomain({ ...fullRow, insights: null });

      expect(result.insights).toBeNull();
    });

    it('passes through empty distribution objects', () => {
      const result = toDomain({
        ...fullRow,
        unit_distribution: {},
        type_distribution: {},
        difficulty_distribution: {},
      });

      expect(result.unitDistribution).toEqual({});
      expect(result.typeDistribution).toEqual({});
      expect(result.difficultyDistribution).toEqual({});
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        examId: 'exam-1',
        unitDistribution: { '이차함수': 0.4 },
        typeDistribution: { 'multiple_choice': 0.75 },
        difficultyDistribution: { 'easy': 0.3 },
        insights: ['수학 II 단원 집중 출제'],
      });

      expect(result.exam_id).toBe('exam-1');
      expect(result.unit_distribution).toEqual({ '이차함수': 0.4 });
      expect(result.type_distribution).toEqual({ 'multiple_choice': 0.75 });
      expect(result.difficulty_distribution).toEqual({ 'easy': 0.3 });
      expect(result.insights).toEqual(['수학 II 단원 집중 출제']);
    });

    it('maps partial update with only insights', () => {
      const result = toPersistence({ insights: null });

      expect(result).toEqual({ insights: null });
    });

    it('excludes undefined fields', () => {
      // 정의되지 않은 필드는 row에 포함되지 않아야 함
      const result = toPersistence({ examId: 'exam-2' });

      expect(result).toHaveProperty('exam_id', 'exam-2');
      expect(result).not.toHaveProperty('unit_distribution');
      expect(result).not.toHaveProperty('type_distribution');
      expect(result).not.toHaveProperty('difficulty_distribution');
      expect(result).not.toHaveProperty('insights');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
