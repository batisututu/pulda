import { toDomain, toPersistence } from '@/infrastructure/mappers/CacheMapper';
import type { CacheRow } from '@/infrastructure/mappers/CacheMapper';

describe('CacheMapper', () => {
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();

  // classification, explanation 모두 채워진 기준 row
  const fullRow: CacheRow = {
    id: 'cache-1',
    content_hash: 'abc123def456',
    classification: {
      questionId: 'q-1',
      subject: 'math',
      unit: '이차함수',
      subUnit: '꼭짓점과 축',
      difficulty: 'medium',
      questionType: 'multiple_choice',
      reasoning: '이차함수 단원에 해당하는 문제',
    },
    explanation: {
      questionId: 'q-1',
      errorType: 'concept_gap',
      confidence: 0.87,
      correctAnswer: '2',
      stepByStep: '\\(x^2 = 4\\) 에서 \\(x = \\pm 2\\)',
      errorReasoning: '부호 처리 오류',
      correctionGuidance: '양수와 음수 모두 고려하세요',
      verification: { verified: true, verifierAnswer: '2', match: true },
      visualExplanation: null,
    },
    hit_count: 5,
    created_at: createdAt,
    updated_at: updatedAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('cache-1');
      expect(result.contentHash).toBe('abc123def456');
      expect(result.hitCount).toBe(5);
      expect(result.createdAt).toBe(createdAt);
      expect(result.updatedAt).toBe(updatedAt);
    });

    it('casts classification and explanation objects as domain types', () => {
      const result = toDomain(fullRow);

      // classification 객체가 그대로 전달되어야 함
      expect(result.classification).toEqual(fullRow.classification);
      expect(result.explanation).toEqual(fullRow.explanation);
    });

    it('preserves null classification', () => {
      // classification이 null인 캐시 엔트리도 허용됨
      const result = toDomain({ ...fullRow, classification: null });

      expect(result.classification).toBeNull();
    });

    it('preserves null explanation', () => {
      const result = toDomain({ ...fullRow, explanation: null });

      expect(result.explanation).toBeNull();
    });

    it('preserves null for both classification and explanation', () => {
      const result = toDomain({ ...fullRow, classification: null, explanation: null });

      expect(result.classification).toBeNull();
      expect(result.explanation).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const classification = {
        questionId: 'q-1',
        subject: 'math',
        unit: '이차함수',
        subUnit: '꼭짓점과 축',
        difficulty: 'medium' as const,
        questionType: 'multiple_choice' as const,
        reasoning: '이차함수 단원',
      };
      const result = toPersistence({
        contentHash: 'abc123',
        classification,
        explanation: null,
        hitCount: 10,
      });

      expect(result.content_hash).toBe('abc123');
      expect(result.classification).toEqual(classification);
      expect(result.explanation).toBeNull();
      expect(result.hit_count).toBe(10);
    });

    it('deep-clones classification via structuredClone', () => {
      const classification = {
        questionId: 'q-1',
        subject: 'math',
        unit: '이차함수',
        subUnit: '꼭짓점과 축',
        difficulty: 'medium' as const,
        questionType: 'multiple_choice' as const,
        reasoning: '이차함수 단원',
      };
      const result = toPersistence({ classification });

      // structuredClone으로 깊은 복사가 이루어져야 함
      expect(result.classification).toEqual(classification);
      expect(result.classification).not.toBe(classification);
    });

    it('maps partial update with only hitCount', () => {
      const result = toPersistence({ hitCount: 99 });

      expect(result).toEqual({ hit_count: 99 });
    });

    it('sets null classification as null in row', () => {
      // 명시적 null은 row에 포함되어야 함
      const result = toPersistence({ classification: null });

      expect(result).toHaveProperty('classification', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ hitCount: 1 });

      expect(result).not.toHaveProperty('content_hash');
      expect(result).not.toHaveProperty('classification');
      expect(result).not.toHaveProperty('explanation');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
