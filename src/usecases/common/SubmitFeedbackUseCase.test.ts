import { SubmitFeedbackUseCase } from '@/usecases/common/SubmitFeedbackUseCase';
import { mockFeedbackRepository } from '@/__tests__/mockBuilders';
import { ValidationError } from '@/shared/errors';

describe('SubmitFeedbackUseCase', () => {
  const setup = () => {
    const feedbackRepo = mockFeedbackRepository();
    const useCase = new SubmitFeedbackUseCase(feedbackRepo);
    return { useCase, feedbackRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: valid content and page returns feedbackId', async () => {
    const { useCase, feedbackRepo } = setup();

    feedbackRepo.upsert.mockResolvedValue({
      id: 'fb-001',
      userId: 'u1',
      targetType: 'explanation',
      targetId: 'some-id',
      rating: 1,
      createdAt: new Date().toISOString(),
    });

    const result = await useCase.execute({
      userId: 'u1',
      content: 'Great explanation!',
      page: 'explanation',
    });

    expect(result.feedbackId).toBe('fb-001');
    expect(feedbackRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        targetType: 'explanation',
        rating: 1,
      }),
    );
  });

  it('throws ValidationError for empty content', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', content: '', page: 'explanation' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for whitespace-only content', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', content: '   \t\n  ', page: 'explanation' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid page type', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', content: 'Feedback text', page: 'invalid' }),
    ).rejects.toThrow(ValidationError);
  });

  it('accepts all valid target types: explanation, variant, blueprint', async () => {
    const { useCase, feedbackRepo } = setup();

    for (const page of ['explanation', 'variant', 'blueprint']) {
      feedbackRepo.upsert.mockResolvedValue({
        id: `fb-${page}`,
        userId: 'u1',
        targetType: page,
        targetId: 'some-id',
        rating: 1,
        createdAt: new Date().toISOString(),
      });

      const result = await useCase.execute({
        userId: 'u1',
        content: `Feedback for ${page}`,
        page,
      });

      expect(result.feedbackId).toBe(`fb-${page}`);
    }

    expect(feedbackRepo.upsert).toHaveBeenCalledTimes(3);
  });
});
