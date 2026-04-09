import { toDomain, toPersistence } from '@/infrastructure/mappers/DiagnosisMapper';
import type { DiagnosisRow } from '@/infrastructure/mappers/DiagnosisMapper';
import type { VisualExplanation } from '@/domain/value-objects';

describe('DiagnosisMapper', () => {
  const createdAt = new Date().toISOString();

  // verificationResult, visualExplanation 모두 채워진 기준 row
  const fullRow: DiagnosisRow = {
    id: 'diag-1',
    question_id: 'q-1',
    error_type: 'concept_gap',
    confidence: 0.92,
    reasoning: '이차함수 개념 부족으로 인한 오답',
    correction: '이차함수의 꼭짓점 공식을 다시 확인하세요',
    step_by_step: '1단계: \\(f(x) = a(x-p)^2 + q\\) 형태로 변환',
    verification_result: {
      verified: true,
      verifierAnswer: '3',
      match: true,
    },
    visual_explanation: {
      type: 'flow',
      data: {
        nodes: [{ id: 'n1', type: 'step', label: '식 변환', latex: null, status: 'correct' }],
        edges: [],
        errorNodeId: null,
        summary: '이차함수 풀이 흐름',
        conceptKeywords: ['이차함수', '꼭짓점'],
      },
    },
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('diag-1');
      expect(result.questionId).toBe('q-1');
      expect(result.errorType).toBe('concept_gap');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('이차함수 개념 부족으로 인한 오답');
      expect(result.correction).toBe('이차함수의 꼭짓점 공식을 다시 확인하세요');
      expect(result.stepByStep).toBe('1단계: \\(f(x) = a(x-p)^2 + q\\) 형태로 변환');
      expect(result.createdAt).toBe(createdAt);
    });

    it('casts all ErrorType values', () => {
      // 모든 오류 유형 enum 값이 올바르게 캐스팅되어야 함
      const errorTypes = [
        'concept_gap', 'calculation_error', 'time_pressure',
        'comprehension_error', 'grammar_error', 'vocabulary_gap', 'interpretation_error',
      ] as const;

      for (const errorType of errorTypes) {
        const result = toDomain({ ...fullRow, error_type: errorType });
        expect(result.errorType).toBe(errorType);
      }
    });

    it('casts verificationResult as VerificationResult', () => {
      const result = toDomain(fullRow);

      expect(result.verificationResult).toEqual(fullRow.verification_result);
    });

    it('preserves null verificationResult', () => {
      // 검증 결과가 없는 진단도 허용됨
      const result = toDomain({ ...fullRow, verification_result: null });

      expect(result.verificationResult).toBeNull();
    });

    it('casts visualExplanation as VisualExplanation', () => {
      const result = toDomain(fullRow);

      expect(result.visualExplanation).toEqual(fullRow.visual_explanation);
    });

    it('preserves null visualExplanation', () => {
      const result = toDomain({ ...fullRow, visual_explanation: null });

      expect(result.visualExplanation).toBeNull();
    });

    it('preserves null stepByStep', () => {
      const result = toDomain({ ...fullRow, step_by_step: null });

      expect(result.stepByStep).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        questionId: 'q-1',
        errorType: 'calculation_error',
        confidence: 0.85,
        reasoning: '계산 실수',
        correction: '부호 확인 필요',
        stepByStep: '1단계: 식 정리',
        verificationResult: { verified: true, verifierAnswer: '4', match: true },
        visualExplanation: null,
      });

      expect(result.question_id).toBe('q-1');
      expect(result.error_type).toBe('calculation_error');
      expect(result.confidence).toBe(0.85);
      expect(result.reasoning).toBe('계산 실수');
      expect(result.correction).toBe('부호 확인 필요');
      expect(result.step_by_step).toBe('1단계: 식 정리');
      expect(result.verification_result).toEqual({ verified: true, verifierAnswer: '4', match: true });
      expect(result.visual_explanation).toBeNull();
    });

    it('maps partial update with only confidence', () => {
      const result = toPersistence({ confidence: 0.5 });

      expect(result).toEqual({ confidence: 0.5 });
    });

    it('sets null verificationResult as null in row', () => {
      // 명시적 null은 row에 포함되어야 함
      const result = toPersistence({ verificationResult: null });

      expect(result).toHaveProperty('verification_result', null);
    });

    it('sets null visualExplanation as null in row', () => {
      const result = toPersistence({ visualExplanation: null });

      expect(result).toHaveProperty('visual_explanation', null);
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ reasoning: '개념 미숙' });

      expect(result).not.toHaveProperty('question_id');
      expect(result).not.toHaveProperty('error_type');
      expect(result).not.toHaveProperty('confidence');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
