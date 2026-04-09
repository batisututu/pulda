import { FollowUserUseCase } from '@/usecases/social/FollowUserUseCase';
import { makeUser, makeFollow } from '@/__tests__/factories';
import {
  mockFollowRepository,
  mockUserRepository,
  mockNotificationRepository,
} from '@/__tests__/mockBuilders';
import { ValidationError, ConflictError, NotFoundError } from '@/shared/errors';

describe('FollowUserUseCase', () => {
  const setup = () => {
    const followRepo = mockFollowRepository();
    const userRepo = mockUserRepository();
    const notificationRepo = mockNotificationRepository();
    const useCase = new FollowUserUseCase(followRepo, userRepo, notificationRepo);
    return { useCase, followRepo, userRepo, notificationRepo };
  };

  it('happy path: creates follow, returns followId + pending, notifies target', async () => {
    const { useCase, followRepo, userRepo, notificationRepo } = setup();

    followRepo.findBetween.mockResolvedValue(null);
    followRepo.countFollowing.mockResolvedValue(5);

    const targetUser = makeUser({ id: 'target-1', nickname: 'targetUser' });
    const followerUser = makeUser({ id: 'follower-1', nickname: 'followerUser' });
    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'target-1') return targetUser;
      if (id === 'follower-1') return followerUser;
      return null;
    });

    const result = await useCase.execute({
      followerId: 'follower-1',
      followingId: 'target-1',
    });

    expect(result.followId).toBeDefined();
    expect(result.status).toBe('pending');
    expect(followRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ followerId: 'follower-1', followingId: 'target-1', status: 'pending' }),
    );
    expect(notificationRepo.create).toHaveBeenCalledOnce();
  });

  it('self-follow throws ValidationError', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ followerId: 'same-user', followingId: 'same-user' }),
    ).rejects.toThrow(ValidationError);
  });

  it('existing follow throws ConflictError', async () => {
    const { useCase, followRepo } = setup();
    followRepo.findBetween.mockResolvedValue(makeFollow({ followerId: 'f1', followingId: 'f2' }));

    await expect(
      useCase.execute({ followerId: 'f1', followingId: 'f2' }),
    ).rejects.toThrow(ConflictError);
  });

  it('at limit (200 following) throws ValidationError', async () => {
    const { useCase, followRepo } = setup();
    followRepo.findBetween.mockResolvedValue(null);
    followRepo.countFollowing.mockResolvedValue(200);

    await expect(
      useCase.execute({ followerId: 'f1', followingId: 'f2' }),
    ).rejects.toThrow(ValidationError);
  });

  it('target user not found throws NotFoundError', async () => {
    const { useCase, followRepo, userRepo } = setup();
    followRepo.findBetween.mockResolvedValue(null);
    followRepo.countFollowing.mockResolvedValue(0);
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ followerId: 'f1', followingId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('notification includes correct data', async () => {
    const { useCase, followRepo, userRepo, notificationRepo } = setup();

    followRepo.findBetween.mockResolvedValue(null);
    followRepo.countFollowing.mockResolvedValue(0);

    const targetUser = makeUser({ id: 'target-1' });
    const followerUser = makeUser({ id: 'follower-1', nickname: 'CoolStudent' });
    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'target-1') return targetUser;
      if (id === 'follower-1') return followerUser;
      return null;
    });

    await useCase.execute({ followerId: 'follower-1', followingId: 'target-1' });

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'target-1',
        type: 'follow_request',
        data: expect.objectContaining({ followerId: 'follower-1' }),
      }),
    );
  });

  it('follow created with pending status regardless of input', async () => {
    const { useCase, followRepo, userRepo } = setup();

    followRepo.findBetween.mockResolvedValue(null);
    followRepo.countFollowing.mockResolvedValue(0);

    const targetUser = makeUser({ id: 'target-1' });
    const followerUser = makeUser({ id: 'follower-1' });
    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'target-1') return targetUser;
      if (id === 'follower-1') return followerUser;
      return null;
    });

    const result = await useCase.execute({
      followerId: 'follower-1',
      followingId: 'target-1',
    });

    expect(result.status).toBe('pending');
    expect(followRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });
});
