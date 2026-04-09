import { toDomain, toPersistence } from '@/infrastructure/mappers/ExamMapper';
import type { ExamRow } from '@/infrastructure/mappers/ExamMapper';

describe('ExamMapper', () => {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const fullRow: ExamRow = {
    id: 'exam-1',
    user_id: 'user-1',
    subject: 'math',
    service_tier: 'ai_analysis',
    image_url: 'https://storage.example.com/exams/test.jpg',
    ocr_result: {
      questions: [{ number: 1, content: 'x^2 = 4' }],
      metadata: { totalQuestions: 1, pageNumber: 1, confidence: 0.95 },
    },
    status: 'ocr_done',
    created_at: now,
    expires_at: expiresAt,
  };

  describe('toDomain', () => {
    it('maps all snake_case fields to camelCase entity', () => {
      const result = toDomain(fullRow);

      expect(result.id).toBe('exam-1');
      expect(result.userId).toBe('user-1');
      expect(result.imageUrl).toBe('https://storage.example.com/exams/test.jpg');
      expect(result.status).toBe('ocr_done');
      expect(result.createdAt).toBe(now);
      expect(result.expiresAt).toBe(expiresAt);
    });

    it('preserves null image_url and ocr_result', () => {
      const row: ExamRow = { ...fullRow, image_url: null, ocr_result: null };
      const result = toDomain(row);

      expect(result.imageUrl).toBeNull();
      expect(result.ocrResult).toBeNull();
    });

    it('casts non-null ocrResult as OcrResult', () => {
      const result = toDomain(fullRow);

      expect(result.ocrResult).not.toBeNull();
      expect(result.ocrResult).toEqual(fullRow.ocr_result);
    });

    it('casts status string to ExamStatus', () => {
      const statuses = ['processing', 'ocr_done', 'verified', 'analyzed', 'completed', 'error'] as const;
      for (const status of statuses) {
        const row: ExamRow = { ...fullRow, status };
        const result = toDomain(row);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('toPersistence', () => {
    it('maps full entity to all snake_case keys', () => {
      const result = toPersistence({
        userId: 'user-1',
        imageUrl: 'https://storage.example.com/exams/test.jpg',
        ocrResult: {
          questions: [{ number: 1, content: 'x^2 = 4', type: 'short_answer', options: null, answer: '2', points: 4, needsReview: false, ocrConfidence: 0.95 }],
          metadata: { totalQuestions: 1, pageNumber: 1, confidence: 0.95 },
          examInfo: { detectedSubject: 'math', detectedGrade: 'high1', examType: 'midterm_1' },
        },
        status: 'ocr_done',
        expiresAt,
      });

      expect(result.user_id).toBe('user-1');
      expect(result.image_url).toBe('https://storage.example.com/exams/test.jpg');
      expect(result.ocr_result).toBeDefined();
      expect(result.status).toBe('ocr_done');
      expect(result.expires_at).toBe(expiresAt);
    });

    it('maps partial entity with only status', () => {
      const result = toPersistence({ status: 'ocr_done' });

      expect(result).toEqual({ status: 'ocr_done' });
    });

    it('excludes undefined fields', () => {
      const result = toPersistence({ status: 'verified' });

      expect(result).not.toHaveProperty('user_id');
      expect(result).not.toHaveProperty('image_url');
      expect(result).not.toHaveProperty('ocr_result');
      expect(result).not.toHaveProperty('expires_at');
    });

    it('deep-clones ocrResult via JSON.parse(JSON.stringify)', () => {
      const ocrResult = {
        questions: [{ number: 1, content: 'x^2', type: 'short_answer' as const, options: null, answer: '2', points: 4, needsReview: false, ocrConfidence: 0.95 }],
        metadata: { totalQuestions: 1, pageNumber: 1, confidence: 0.95 },
        examInfo: { detectedSubject: 'math', detectedGrade: 'high1', examType: 'midterm_1' },
      };
      const result = toPersistence({ ocrResult });

      expect(result.ocr_result).toEqual(ocrResult);
      expect(result.ocr_result).not.toBe(ocrResult);
    });

    it('preserves null ocrResult as null', () => {
      const result = toPersistence({ ocrResult: null });

      expect(result).toHaveProperty('ocr_result');
      expect(result.ocr_result).toBeNull();
    });

    it('returns empty object when called with empty partial', () => {
      const result = toPersistence({});

      expect(result).toEqual({});
    });
  });
});
