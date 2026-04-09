import { toDomain, toPersistence } from '@/infrastructure/mappers/VariantMapper';
import type { VariantRow } from '@/infrastructure/mappers/VariantMapper';
import type { VariantVerificationResult } from '@/domain/entities';
import type { VisualExplanation } from '@/domain/value-objects';

describe('VariantMapper', () => {
  const createdAt = new Date().toISOString();

  // verification, visualExplanation 포함한 완전한 기준 row
  const fullRow: VariantRow = {
    id: 'vq-1',
    diagnosis_id: 'diag-1',
    content: '\\(x^2 - 5x + 6 = 0\\) 을 풀어라.',
    question_type: 'multiple_choice',
    options: ['1', '2', '3', '4', '5'],
    answer: '3',
    explanation: '인수분해: \\((x-2)(x-3)=0\\)',
    difficulty: 'medium',
    target_error_type: 'concept_gap',
    user_id: 'user-1',
    topic: '이차방정식',
    grade: 'grade_10',
    bloom_level: 'application',
    trap_point: '공약수를 놓치는 경우',
    target_time_seconds: 120,
    verification_result: {
      verified: true,
      aiComputedAnswer: '3',
      generatedAnswer: '3',
      match: true,
      confidence: 'high',
    },
    visual_explanation: {
      type: 'flow',
      data: {
        nodes: [{ id: 'n1', type: 'step', label: '인수분해', latex: '(x-2)(x-3)', status: 'correct' }],
        edges: [],
        errorNodeId: null,
        summary: '이차방정식 인수분해',
        conceptKeywords: ['이차방정식', '인수분해'],
      },
    },
    created_at: createdAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('vq-1');
      expect(result.diagnosisId).toBe('diag-1');
      expect(result.content).toBe('\\(x^2 - 5x + 6 = 0\\) 을 풀어라.');
      expect(result.questionType).toBe('multiple_choice');
      expect(result.options).toEqual(['1', '2', '3', '4', '5']);
      expect(result.answer).toBe('3');
      expect(result.explanation).toBe('인수분해: \\((x-2)(x-3)=0\\)');
      expect(result.difficulty).toBe('medium');
      expect(result.targetErrorType).toBe('concept_gap');
      expect(result.userId).toBe('user-1');
      expect(result.topic).toBe('이차방정식');
      expect(result.grade).toBe('grade_10');
      expect(result.bloomLevel).toBe('application');
      expect(result.trapPoint).toBe('공약수를 놓치는 경우');
      expect(result.targetTimeSeconds).toBe(120);
      expect(result.createdAt).toBe(createdAt);
    });

    it('casts all QuestionType values', () => {
      const types = ['multiple_choice', 'short_answer', 'essay'] as const;

      for (const questionType of types) {
        const result = toDomain({ ...fullRow, question_type: questionType });
        expect(result.questionType).toBe(questionType);
      }
    });

    it('casts all Difficulty values', () => {
      const difficulties = ['easy', 'medium', 'hard'] as const;

      for (const difficulty of difficulties) {
        const result = toDomain({ ...fullRow, difficulty });
        expect(result.difficulty).toBe(difficulty);
      }
    });

    it('casts all BloomLevel values', () => {
      // Bloom의 인지 수준 6단계가 올바르게 캐스팅되어야 함
      const bloomLevels = ['knowledge', 'comprehension', 'application', 'analysis', 'synthesis', 'evaluation'] as const;

      for (const bloomLevel of bloomLevels) {
        const result = toDomain({ ...fullRow, bloom_level: bloomLevel });
        expect(result.bloomLevel).toBe(bloomLevel);
      }
    });

    it('casts verificationResult as VariantVerificationResult', () => {
      const result = toDomain(fullRow);

      expect(result.verification).toEqual(fullRow.verification_result);
    });

    it('casts visualExplanation as VisualExplanation', () => {
      const result = toDomain(fullRow);

      expect(result.visualExplanation).toEqual(fullRow.visual_explanation);
    });

    it('defaults null diagnosis_id to null', () => {
      // diagnosisId가 없는 독립 생성 변형 문제 허용
      const result = toDomain({ ...fullRow, diagnosis_id: null });

      expect(result.diagnosisId).toBeNull();
    });

    it('preserves null options for non-multiple-choice questions', () => {
      // 주관식 문제는 options가 null임
      const result = toDomain({ ...fullRow, question_type: 'short_answer', options: null });

      expect(result.options).toBeNull();
    });

    it('preserves null targetErrorType', () => {
      const result = toDomain({ ...fullRow, target_error_type: null });

      expect(result.targetErrorType).toBeNull();
    });

    it('preserves null userId', () => {
      const result = toDomain({ ...fullRow, user_id: null });

      expect(result.userId).toBeNull();
    });

    it('preserves null topic, grade, bloomLevel, trapPoint, targetTimeSeconds', () => {
      // 메타데이터 없는 변형 문제도 허용됨
      const result = toDomain({
        ...fullRow,
        topic: null,
        grade: null,
        bloom_level: null,
        trap_point: null,
        target_time_seconds: null,
      });

      expect(result.topic).toBeNull();
      expect(result.grade).toBeNull();
      expect(result.bloomLevel).toBeNull();
      expect(result.trapPoint).toBeNull();
      expect(result.targetTimeSeconds).toBeNull();
    });

    it('preserves null verificationResult', () => {
      const result = toDomain({ ...fullRow, verification_result: null });

      expect(result.verification).toBeNull();
    });

    it('preserves null visualExplanation', () => {
      const result = toDomain({ ...fullRow, visual_explanation: null });

      expect(result.visualExplanation).toBeNull();
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const verification: VariantVerificationResult = {
        verified: true,
        aiComputedAnswer: '2',
        generatedAnswer: '2',
        match: true,
        confidence: 'high',
      };
      const result = toPersistence({
        diagnosisId: 'diag-1',
        content: '\\(x+1=3\\)',
        questionType: 'short_answer',
        options: null,
        answer: '2',
        explanation: '양변에서 1을 빼면',
        difficulty: 'easy',
        targetErrorType: 'calculation_error',
        userId: 'user-1',
        topic: '일차방정식',
        grade: 'grade_7',
        bloomLevel: 'knowledge',
        trapPoint: null,
        targetTimeSeconds: 60,
        verification,
        visualExplanation: null,
      });

      expect(result.diagnosis_id).toBe('diag-1');
      expect(result.content).toBe('\\(x+1=3\\)');
      expect(result.question_type).toBe('short_answer');
      expect(result.options).toBeNull();
      expect(result.answer).toBe('2');
      expect(result.explanation).toBe('양변에서 1을 빼면');
      expect(result.difficulty).toBe('easy');
      expect(result.target_error_type).toBe('calculation_error');
      expect(result.user_id).toBe('user-1');
      expect(result.topic).toBe('일차방정식');
      expect(result.grade).toBe('grade_7');
      expect(result.bloom_level).toBe('knowledge');
      expect(result.trap_point).toBeNull();
      expect(result.target_time_seconds).toBe(60);
      expect(result.verification_result).toEqual(verification);
      expect(result.visual_explanation).toBeNull();
    });

    it('maps partial update with only difficulty', () => {
      const result = toPersistence({ difficulty: 'hard' });

      expect(result).toEqual({ difficulty: 'hard' });
    });

    it('maps partial update with only content', () => {
      const result = toPersistence({ content: '새로운 문제 내용' });

      expect(result).toEqual({ content: '새로운 문제 내용' });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ answer: '4' });

      expect(result).not.toHaveProperty('diagnosis_id');
      expect(result).not.toHaveProperty('content');
      expect(result).not.toHaveProperty('question_type');
      expect(result).not.toHaveProperty('difficulty');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
