import { toDomain, toPersistence } from '@/infrastructure/mappers/QuestionMapper';
import type { QuestionRow } from '@/infrastructure/mappers/QuestionMapper';

describe('QuestionMapper', () => {
  const now = new Date().toISOString();

  const fullRow: QuestionRow = {
    id: 'q-1',
    exam_id: 'exam-1',
    subject: 'math',
    number: 3,
    content: 'x^2 + 2x + 1 = 0',
    question_type: 'multiple_choice',
    options: ['1', '2', '3', '4', '5'],
    answer: '1',
    student_answer: '2',
    is_correct: false,
    points: 4,
    created_at: now,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('q-1');
      expect(result.examId).toBe('exam-1');
      expect(result.number).toBe(3);
      expect(result.content).toBe('x^2 + 2x + 1 = 0');
      expect(result.questionType).toBe('multiple_choice');
      expect(result.options).toEqual(['1', '2', '3', '4', '5']);
      expect(result.answer).toBe('1');
      expect(result.studentAnswer).toBe('2');
      expect(result.isCorrect).toBe(false);
      expect(result.points).toBe(4);
      expect(result.createdAt).toBe(now);
    });

    it('preserves null fields (options, answer, student_answer, is_correct, points)', () => {
      const row: QuestionRow = {
        ...fullRow,
        options: null,
        answer: null,
        student_answer: null,
        is_correct: null,
        points: null,
      };
      const result = toDomain(row);

      expect(result.options).toBeNull();
      expect(result.answer).toBeNull();
      expect(result.studentAnswer).toBeNull();
      expect(result.isCorrect).toBeNull();
      expect(result.points).toBeNull();
    });

    it('casts question_type to QuestionType', () => {
      const types = ['multiple_choice', 'short_answer', 'essay'] as const;
      for (const qt of types) {
        const row: QuestionRow = { ...fullRow, question_type: qt };
        const result = toDomain(row);
        expect(result.questionType).toBe(qt);
      }
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        examId: 'exam-1',
        number: 3,
        content: 'x^2 + 2x + 1 = 0',
        questionType: 'multiple_choice',
        options: ['1', '2', '3', '4', '5'],
        answer: '1',
        studentAnswer: '2',
        isCorrect: false,
        points: 4,
      });

      expect(result.exam_id).toBe('exam-1');
      expect(result.number).toBe(3);
      expect(result.content).toBe('x^2 + 2x + 1 = 0');
      expect(result.question_type).toBe('multiple_choice');
      expect(result.options).toEqual(['1', '2', '3', '4', '5']);
      expect(result.answer).toBe('1');
      expect(result.student_answer).toBe('2');
      expect(result.is_correct).toBe(false);
      expect(result.points).toBe(4);
    });

    it('maps partial update with only isCorrect and studentAnswer', () => {
      const result = toPersistence({ isCorrect: true, studentAnswer: '3' });

      expect(result).toEqual({ is_correct: true, student_answer: '3' });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ isCorrect: false });

      expect(result).toEqual({ is_correct: false });
      expect(result).not.toHaveProperty('exam_id');
      expect(result).not.toHaveProperty('number');
      expect(result).not.toHaveProperty('content');
      expect(result).not.toHaveProperty('question_type');
      expect(result).not.toHaveProperty('options');
      expect(result).not.toHaveProperty('answer');
      expect(result).not.toHaveProperty('student_answer');
      expect(result).not.toHaveProperty('points');
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
