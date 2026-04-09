import { GetFeedUseCase } from '@/usecases/social/GetFeedUseCase';
import { makeFeedItem } from '@/__tests__/factories';
import { mockSharedItemRepository } from '@/__tests__/mockBuilders';
import { ValidationError } from '@/shared/errors';

describe('GetFeedUseCase', () => {
  const setup = () => {
    const sharedItemRepo = mockSharedItemRepository();
    const useCase = new GetFeedUseCase(sharedItemRepo);
    return { useCase, sharedItemRepo };
  };

  it('returns items and hasMore=true when items exceed limit', async () => {
    const { useCase, sharedItemRepo } = setup();

    const items = Array.from({ length: 11 }, (_, i) =>
      makeFeedItem({ id: `item-${i}` }),
    );
    sharedItemRepo.findFeed.mockResolvedValue(items);

    const result = await useCase.execute({ userId: 'u1', page: 1, limit: 10 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe('item-0');
  });

  it('returns hasMore=false when items fit within limit', async () => {
    const { useCase, sharedItemRepo } = setup();

    const items = Array.from({ length: 5 }, (_, i) =>
      makeFeedItem({ id: `item-${i}` }),
    );
    sharedItemRepo.findFeed.mockResolvedValue(items);

    const result = await useCase.execute({ userId: 'u1', page: 1, limit: 10 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  it('throws ValidationError for page < 1', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', page: 0, limit: 10 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for limit < 1', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', page: 1, limit: 0 }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for limit > 50', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', page: 1, limit: 51 }),
    ).rejects.toThrow(ValidationError);
  });

  it('fetches limit+1 items to determine hasMore', async () => {
    const { useCase, sharedItemRepo } = setup();

    sharedItemRepo.findFeed.mockResolvedValue([]);

    await useCase.execute({ userId: 'u1', page: 1, limit: 10 });

    expect(sharedItemRepo.findFeed).toHaveBeenCalledWith('u1', {
      page: 1,
      limit: 11,
    });
  });
});
