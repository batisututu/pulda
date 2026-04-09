import { ShareItemUseCase } from '@/usecases/social/ShareItemUseCase';
import { makeFollow } from '@/__tests__/factories';
import {
  mockSharedItemRepository,
  mockFollowRepository,
  mockNotificationRepository,
} from '@/__tests__/mockBuilders';
import { ForbiddenError, ValidationError } from '@/shared/errors';

describe('ShareItemUseCase', () => {
  const setup = () => {
    const sharedItemRepo = mockSharedItemRepository();
    const followRepo = mockFollowRepository();
    const notificationRepo = mockNotificationRepository();
    const useCase = new ShareItemUseCase(sharedItemRepo, followRepo, notificationRepo);
    return { useCase, sharedItemRepo, followRepo, notificationRepo };
  };

  it('happy path: shareable type created, returns sharedItemId', async () => {
    const { useCase, sharedItemRepo, followRepo } = setup();
    followRepo.findByFollowing.mockResolvedValue([]);

    const result = await useCase.execute({
      userId: 'u1',
      itemType: 'variant_set',
      itemId: 'item-1',
      visibility: 'followers_only',
      caption: 'Check this out',
    });

    expect(result.sharedItemId).toBeDefined();
    expect(sharedItemRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        itemType: 'variant_set',
        itemId: 'item-1',
        visibility: 'followers_only',
        caption: 'Check this out',
      }),
    );
  });

  it('original exam (itemType=exam) throws ForbiddenError', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        userId: 'u1',
        itemType: 'exam',
        itemId: 'item-1',
        visibility: 'public',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('original exam_image throws ForbiddenError', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        userId: 'u1',
        itemType: 'exam_image',
        itemId: 'item-1',
        visibility: 'public',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('unknown type (itemType=random) throws ValidationError', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        userId: 'u1',
        itemType: 'random',
        itemId: 'item-1',
        visibility: 'public',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('accepted followers notified (filter out pending/blocked)', async () => {
    const { useCase, followRepo, notificationRepo } = setup();

    const accepted = makeFollow({ followerId: 'f1', followingId: 'u1', status: 'accepted' });
    const pending = makeFollow({ followerId: 'f2', followingId: 'u1', status: 'pending' });
    followRepo.findByFollowing.mockResolvedValue([accepted, pending]);

    await useCase.execute({
      userId: 'u1',
      itemType: 'error_note',
      itemId: 'item-1',
      visibility: 'followers_only',
    });

    // Wait for fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0));

    // Only accepted follower (f1) should get notification
    expect(notificationRepo.create).toHaveBeenCalledTimes(1);
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'f1',
        type: 'new_share',
      }),
    );
  });

  it('notification failure does not throw', async () => {
    const { useCase, followRepo, notificationRepo } = setup();

    const accepted = makeFollow({ followerId: 'f1', followingId: 'u1', status: 'accepted' });
    followRepo.findByFollowing.mockResolvedValue([accepted]);
    notificationRepo.create.mockRejectedValue(new Error('Notification service down'));

    const result = await useCase.execute({
      userId: 'u1',
      itemType: 'mini_test_result',
      itemId: 'item-1',
      visibility: 'public',
    });

    // Should still return successfully despite notification failure
    expect(result.sharedItemId).toBeDefined();
  });
});
