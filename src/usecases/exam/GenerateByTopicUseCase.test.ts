import type { IVariantRepository } from '@/domain/ports/repositories';
import type { IVariantGeneratorGateway } from '@/domain/ports/gateways';
import { ValidationError } from '@/shared/errors';
import { mockVariantRepository } from '@/__tests__/mockBuilders';
import { mockVariantGeneratorGateway } from '@/__tests__/mockGateways';
import { GenerateByTopicUseCase } from './GenerateByTopicUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('GenerateByTopicUseCase', () => {
  const userId = 'user-001';

  let variantRepo: Mocked<IVariantRepository>;
  let variantGenGw: Mocked<IVariantGeneratorGateway>;
  let useCase: GenerateByTopicUseCase;

  const defaultInput = {
    userId,
    topic: '이차방정식',
    grade: 'high1',
    difficulty: 'medium' as const,
    questionType: 'short_answer' as const,
    count: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    variantRepo = mockVariantRepository();
    variantGenGw = mockVariantGeneratorGateway();

    useCase = new GenerateByTopicUseCase(variantRepo, variantGenGw);

    // Default: generateByTopic returns some variants
    variantGenGw.generateByTopic.mockResolvedValue({
      diagnosisId: null,
      variants: [
        {
          content: '$x^2 - 4 = 0$을 풀어라.',
          type: 'short_answer',
          options: null,
          answer: '2',
          explanation: '$(x-2)(x+2) = 0$',
          difficulty: 'medium',
          targetErrorType: 'concept_gap',
          bloomLevel: 'application',
          trapPoint: null,
          targetTimeSeconds: 120,
          verification: null,
        },
      ],
    });
  });

  it('generates variants by topic, persists them, and returns result', async () => {
    const result = await useCase.execute(defaultInput);

    // AI gateway was called with trimmed topic
    expect(variantGenGw.generateByTopic).toHaveBeenCalledWith({
      topic: '이차방정식',
      grade: 'high1',
      difficulty: 'medium',
      questionType: 'short_answer',
      count: 3,
    });

    // Variants were persisted with userId, topic, grade
    expect(variantRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          diagnosisId: null,
          userId,
          topic: '이차방정식',
          grade: 'high1',
          content: '$x^2 - 4 = 0$을 풀어라.',
          questionType: 'short_answer',
          answer: '2',
        }),
      ]),
    );

    expect(result.variants).toBeDefined();
    expect(result.variants.length).toBeGreaterThan(0);
    expect(result.creditsUsed).toBe(0);
  });

  it('throws ValidationError for empty topic', async () => {
    await expect(
      useCase.execute({ ...defaultInput, topic: '' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for whitespace-only topic', async () => {
    await expect(
      useCase.execute({ ...defaultInput, topic: '   ' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for count=0', async () => {
    await expect(
      useCase.execute({ ...defaultInput, count: 0 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for count=6', async () => {
    await expect(
      useCase.execute({ ...defaultInput, count: 6 }),
    ).rejects.toThrow(ValidationError);
  });

  it('trims topic before passing to AI gateway', async () => {
    await useCase.execute({ ...defaultInput, topic: '  이차방정식  ' });

    expect(variantGenGw.generateByTopic).toHaveBeenCalledWith(
      expect.objectContaining({ topic: '이차방정식' }),
    );

    // Persisted topic is also trimmed
    expect(variantRepo.createMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ topic: '이차방정식' }),
      ]),
    );
  });
});
