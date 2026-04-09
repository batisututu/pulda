import type { IOcrGateway } from '@/domain/ports/gateways/IOcrGateway';
import type { IClassifierGateway } from '@/domain/ports/gateways/IClassifierGateway';
import type { IExplanationGateway } from '@/domain/ports/gateways/IExplanationGateway';
import type { IVerifierGateway } from '@/domain/ports/gateways/IVerifierGateway';
import type { IVariantGeneratorGateway } from '@/domain/ports/gateways/IVariantGeneratorGateway';
import type { IStorageGateway } from '@/domain/ports/gateways/IStorageGateway';
import type { IPaymentGateway } from '@/domain/ports/gateways/IPaymentGateway';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

export function mockOcrGateway(): Mocked<IOcrGateway> {
  return {
    processImage: vi.fn().mockResolvedValue({
      questions: [
        {
          number: 1,
          content: '$x^2 + 2x + 1 = 0$을 풀어라.',
          type: 'short_answer',
          options: null,
          answer: '-1',
          points: 4,
          needsReview: false,
        },
      ],
      metadata: {
        totalQuestions: 1,
        pageNumber: 1,
        confidence: 0.95,
      },
    }),
  };
}

export function mockClassifierGateway(): Mocked<IClassifierGateway> {
  return {
    classify: vi.fn().mockResolvedValue({
      questionId: '',
      subject: '수학',
      unit: '이차방정식',
      subUnit: '근의 공식',
      difficulty: 'medium',
      questionType: 'short_answer',
      reasoning: '이차방정식의 풀이를 묻는 문제입니다.',
    }),
    classifyBatch: vi.fn().mockImplementation((questions) =>
      Promise.resolve(
        questions.map((q: { id: string }) => ({
          questionId: q.id,
          subject: '수학',
          unit: '이차방정식',
          subUnit: '근의 공식',
          difficulty: 'medium',
          questionType: 'short_answer',
          reasoning: '이차방정식의 풀이를 묻는 문제입니다.',
        })),
      ),
    ),
    generateBlueprint: vi.fn().mockResolvedValue({
      unitDistribution: { '이차방정식': 0.5, '함수': 0.5 },
      typeDistribution: { short_answer: 0.6, multiple_choice: 0.4 },
      difficultyDistribution: { easy: 0.2, medium: 0.5, hard: 0.3 },
      insights: ['이차방정식 비중이 높습니다.'],
    }),
  };
}

export function mockExplanationGateway(): Mocked<IExplanationGateway> {
  return {
    diagnose: vi.fn().mockResolvedValue({
      questionId: '',
      errorType: 'concept_gap',
      confidence: 0.85,
      correctAnswer: '-1',
      stepByStep: '1단계: $x^2 + 2x + 1 = (x+1)^2$\n2단계: $(x+1)^2 = 0$\n3단계: $x = -1$',
      errorReasoning: '인수분해 개념이 부족하여 완전제곱식을 인식하지 못했습니다.',
      correctionGuidance: '완전제곱식의 패턴을 학습하세요: $a^2 + 2ab + b^2 = (a+b)^2$',
      verification: {
        verified: true,
        verifierAnswer: '-1',
        match: true,
      },
      visualExplanation: {
        type: 'flow' as const,
        data: {
          nodes: [
            { id: 'n1', type: 'step' as const, label: '식 확인', latex: 'x^2 + 2x + 1 = 0', status: 'correct' as const },
            { id: 'n2', type: 'error_point' as const, label: '인수분해 실패', latex: null, status: 'error' as const },
            { id: 'n3', type: 'result' as const, label: '오답 도출', latex: null, status: 'error' as const },
          ],
          edges: [
            { from: 'n1', to: 'n2', label: null },
            { from: 'n2', to: 'n3', label: '잘못된 풀이' },
          ],
          errorNodeId: 'n2',
          summary: '완전제곱식 인수분해를 인식하지 못함',
          conceptKeywords: ['완전제곱식', '인수분해'],
        },
      },
    }),
  };
}

export function mockVerifierGateway(): Mocked<IVerifierGateway> {
  return {
    verify: vi.fn().mockResolvedValue({
      answer: '-1',
      briefSolution: '$(x+1)^2 = 0$이므로 $x = -1$',
    }),
  };
}

export function mockVariantGeneratorGateway(): Mocked<IVariantGeneratorGateway> {
  return {
    generate: vi.fn().mockResolvedValue({
      diagnosisId: null,
      variants: [
        {
          content: '$x^2 - 4x + 4 = 0$을 풀어라.',
          type: 'short_answer',
          options: null,
          answer: '2',
          explanation: '$(x-2)^2 = 0$이므로 $x = 2$',
          difficulty: 'medium',
          targetErrorType: 'concept_gap',
          bloomLevel: 'application',
          trapPoint: '$(x-2)(x+2)$로 잘못 인수분해할 수 있음',
          targetTimeSeconds: 120,
          verification: null,
          visualExplanation: null,
        },
        {
          content: '$x^2 + 6x + 9 = 0$을 풀어라.',
          type: 'short_answer',
          options: null,
          answer: '-3',
          explanation: '$(x+3)^2 = 0$이므로 $x = -3$',
          difficulty: 'medium',
          targetErrorType: 'concept_gap',
          bloomLevel: 'application',
          trapPoint: null,
          targetTimeSeconds: 120,
          verification: null,
          visualExplanation: null,
        },
        {
          content: '$x^2 - 10x + 25 = 0$을 풀어라.',
          type: 'short_answer',
          options: null,
          answer: '5',
          explanation: '$(x-5)^2 = 0$이므로 $x = 5$',
          difficulty: 'easy',
          targetErrorType: 'concept_gap',
          bloomLevel: 'comprehension',
          trapPoint: null,
          targetTimeSeconds: 90,
          verification: null,
          visualExplanation: null,
        },
      ],
    }),
    generateByTopic: vi.fn().mockResolvedValue({
      diagnosisId: null,
      variants: [],
    }),
  };
}

export function mockStorageGateway(): Mocked<IStorageGateway> {
  return {
    upload: vi.fn().mockResolvedValue('https://storage.example.com/exams/uploaded.jpg'),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed/exam.jpg?token=abc'),
  };
}

export function mockPaymentGateway(): Mocked<IPaymentGateway> {
  return {
    createSession: vi.fn().mockResolvedValue({
      sessionId: 'session-123',
      redirectUrl: 'https://payment.example.com/checkout/session-123',
    }),
    verifyWebhook: vi.fn().mockResolvedValue({
      userId: 'user-001',
      plan: 'standard',
      status: 'success',
      transactionId: 'txn-abc-123',
    }),
  };
}
