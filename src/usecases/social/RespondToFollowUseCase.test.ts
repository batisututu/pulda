import { RespondToFollowUseCase } from '@/usecases/social/RespondToFollowUseCase';
import { makeFollow } from '@/__tests__/factories';
import {
  mockFollowRepository,
  mockNotificationRepository,
} from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';

describe('RespondToFollowUseCase', () => {
  const setup = () => {
    const followRepo = mockFollowRepository();
    const notificationRepo = mockNotificationRepository();
    const useCase = new RespondToFollowUseCase(followRepo, notificationRepo);
    return { useCase, followRepo, notificationRepo };
  };

  const pendingFollow = makeFollow({
    id: 'follow-1',
    followerId: 'requester-1',
    followingId: 'target-1',
    status: 'pending',
  });

  it('accept: updates status to accepted and notifies follower', async () => {
    const { useCase, followRepo, notificationRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    const result = await useCase.execute({
      userId: 'target-1',
      followId: 'follow-1',
      action: 'accept',
    });

    expect(result.status).toBe('accepted');
    expect(followRepo.updateStatus).toHaveBeenCalledWith('follow-1', 'accepted');
    expect(notificationRepo.create).toHaveBeenCalledOnce();
  });

  it('reject: deletes follow and returns deleted status', async () => {
    const { useCase, followRepo, notificationRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    const result = await useCase.execute({
      userId: 'target-1',
      followId: 'follow-1',
      action: 'reject',
    });

    expect(result.status).toBe('deleted');
    expect(followRepo.delete).toHaveBeenCalledWith('follow-1');
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });

  it('block: updates status to blocked with no notification', async () => {
    const { useCase, followRepo, notificationRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    const result = await useCase.execute({
      userId: 'target-1',
      followId: 'follow-1',
      action: 'block',
    });

    expect(result.status).toBe('blocked');
    expect(followRepo.updateStatus).toHaveBeenCalledWith('follow-1', 'blocked');
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when follow not found', async () => {
    const { useCase, followRepo } = setup();
    followRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'target-1', followId: 'missing', action: 'accept' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when userId !== followingId', async () => {
    const { useCase, followRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    await expect(
      useCase.execute({ userId: 'wrong-user', followId: 'follow-1', action: 'accept' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ValidationError when status is not pending', async () => {
    const { useCase, followRepo } = setup();
    const acceptedFollow = makeFollow({
      id: 'follow-1',
      followerId: 'requester-1',
      followingId: 'target-1',
      status: 'accepted',
    });
    followRepo.findById.mockResolvedValue(acceptedFollow);

    await expect(
      useCase.execute({ userId: 'target-1', followId: 'follow-1', action: 'accept' }),
    ).rejects.toThrow(ValidationError);
  });

  it('accept notification has correct userId (followerId) and data', async () => {
    const { useCase, followRepo, notificationRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    await useCase.execute({
      userId: 'target-1',
      followId: 'follow-1',
      action: 'accept',
    });

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'requester-1',
        type: 'follow_accepted',
        data: expect.objectContaining({ followId: 'follow-1', followingId: 'target-1' }),
      }),
    );
  });

  it('block returns followId and blocked status', async () => {
    const { useCase, followRepo } = setup();
    followRepo.findById.mockResolvedValue(pendingFollow);

    const result = await useCase.execute({
      userId: 'target-1',
      followId: 'follow-1',
      action: 'block',
    });

    expect(result).toEqual({ followId: 'follow-1', status: 'blocked' });
  });
});
