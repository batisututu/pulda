import { GetNotificationsUseCase } from '@/usecases/common/GetNotificationsUseCase';
import { makeNotification } from '@/__tests__/factories';
import { mockNotificationRepository } from '@/__tests__/mockBuilders';

describe('GetNotificationsUseCase', () => {
  const setup = () => {
    const notificationRepo = mockNotificationRepository();
    const useCase = new GetNotificationsUseCase(notificationRepo);
    return { useCase, notificationRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: returns notifications and unreadCount', async () => {
    const { useCase, notificationRepo } = setup();

    const notifications = [
      makeNotification({ userId: 'u1', isRead: false }),
      makeNotification({ userId: 'u1', isRead: true }),
    ];
    const unreadNotifications = [notifications[0]];

    // First call: all notifications; second call: unread only
    notificationRepo.findByUser
      .mockResolvedValueOnce(notifications)
      .mockResolvedValueOnce(unreadNotifications);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.notifications).toHaveLength(2);
    expect(result.unreadCount).toBe(1);
  });

  it('caps limit at MAX_LIMIT (50)', async () => {
    const { useCase, notificationRepo } = setup();
    notificationRepo.findByUser.mockResolvedValue([]);

    await useCase.execute({ userId: 'u1', limit: 100 });

    expect(notificationRepo.findByUser).toHaveBeenCalledWith('u1', {
      unreadOnly: undefined,
      limit: 50,
    });
  });

  it('uses default limit (50) when not provided', async () => {
    const { useCase, notificationRepo } = setup();
    notificationRepo.findByUser.mockResolvedValue([]);

    await useCase.execute({ userId: 'u1' });

    expect(notificationRepo.findByUser).toHaveBeenCalledWith('u1', {
      unreadOnly: undefined,
      limit: 50,
    });
  });

  it('when unreadOnly=true, unreadCount equals returned items length', async () => {
    const { useCase, notificationRepo } = setup();

    const unreadItems = [
      makeNotification({ userId: 'u1', isRead: false }),
      makeNotification({ userId: 'u1', isRead: false }),
      makeNotification({ userId: 'u1', isRead: false }),
    ];
    notificationRepo.findByUser.mockResolvedValue(unreadItems);

    const result = await useCase.execute({ userId: 'u1', unreadOnly: true });

    expect(result.unreadCount).toBe(3);
    // Should NOT make a second call when unreadOnly is true
    expect(notificationRepo.findByUser).toHaveBeenCalledTimes(1);
  });

  it('when unreadOnly=false, makes separate call for unread count', async () => {
    const { useCase, notificationRepo } = setup();

    const allNotifications = [
      makeNotification({ userId: 'u1', isRead: false }),
      makeNotification({ userId: 'u1', isRead: true }),
    ];
    const unreadOnly = [allNotifications[0]];

    notificationRepo.findByUser
      .mockResolvedValueOnce(allNotifications)
      .mockResolvedValueOnce(unreadOnly);

    const result = await useCase.execute({ userId: 'u1', unreadOnly: false });

    expect(notificationRepo.findByUser).toHaveBeenCalledTimes(2);
    expect(notificationRepo.findByUser).toHaveBeenNthCalledWith(2, 'u1', {
      unreadOnly: true,
    });
    expect(result.unreadCount).toBe(1);
  });
});
