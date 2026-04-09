import { MarkNotificationReadUseCase } from '@/usecases/common/MarkNotificationReadUseCase';
import { makeNotification } from '@/__tests__/factories';
import { mockNotificationRepository } from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

describe('MarkNotificationReadUseCase', () => {
  const setup = () => {
    const notificationRepo = mockNotificationRepository();
    const useCase = new MarkNotificationReadUseCase(notificationRepo);
    return { useCase, notificationRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('single notification: verifies ownership and marks read', async () => {
    const { useCase, notificationRepo } = setup();

    const notification = makeNotification({ id: 'notif-1', userId: 'u1' });
    notificationRepo.findById.mockResolvedValue(notification);

    const result = await useCase.execute({ userId: 'u1', notificationId: 'notif-1' });

    expect(notificationRepo.findById).toHaveBeenCalledWith('notif-1');
    expect(notificationRepo.markRead).toHaveBeenCalledWith('notif-1');
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundError when notification not found', async () => {
    const { useCase, notificationRepo } = setup();
    notificationRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'u1', notificationId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user does not own notification', async () => {
    const { useCase, notificationRepo } = setup();

    const notification = makeNotification({ id: 'notif-1', userId: 'other-user' });
    notificationRepo.findById.mockResolvedValue(notification);

    await expect(
      useCase.execute({ userId: 'u1', notificationId: 'notif-1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('marks all read when no notificationId provided', async () => {
    const { useCase, notificationRepo } = setup();

    const result = await useCase.execute({ userId: 'u1' });

    expect(notificationRepo.markAllRead).toHaveBeenCalledWith('u1');
    expect(notificationRepo.findById).not.toHaveBeenCalled();
    expect(notificationRepo.markRead).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('returns { success: true } on successful mark', async () => {
    const { useCase, notificationRepo } = setup();

    const notification = makeNotification({ id: 'notif-2', userId: 'u1' });
    notificationRepo.findById.mockResolvedValue(notification);

    const result = await useCase.execute({ userId: 'u1', notificationId: 'notif-2' });

    expect(result).toEqual({ success: true });
  });
});
