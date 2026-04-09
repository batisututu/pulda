import { LinkParentUseCase } from '@/usecases/parent/LinkParentUseCase';
import { makeUser, makeParentLink } from '@/__tests__/factories';
import {
  mockUserRepository,
  mockParentLinkRepository,
  mockNotificationRepository,
} from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError, ExpiredError } from '@/shared/errors';

describe('LinkParentUseCase', () => {
  const setup = () => {
    const userRepo = mockUserRepository();
    const parentLinkRepo = mockParentLinkRepository();
    const notificationRepo = mockNotificationRepository();
    const useCase = new LinkParentUseCase(userRepo, parentLinkRepo, notificationRepo);
    return { useCase, userRepo, parentLinkRepo, notificationRepo };
  };

  it('happy path: valid parent + valid code activates link and returns child info', async () => {
    const { useCase, userRepo, parentLinkRepo, notificationRepo } = setup();

    const parentUser = makeUser({ id: 'p1', role: 'parent' });
    const childUser = makeUser({ id: 'c1', nickname: 'ChildNick', role: 'student' });
    const link = makeParentLink({
      childUserId: 'c1',
      linkCode: 'ABC123',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'p1') return parentUser;
      if (id === 'c1') return childUser;
      return null;
    });
    parentLinkRepo.findByCode.mockResolvedValue(link);

    const result = await useCase.execute({ parentUserId: 'p1', linkCode: 'abc123' });

    expect(result.status).toBe('active');
    expect(result.childUserId).toBe('c1');
    expect(result.childNickname).toBe('ChildNick');
    expect(result.linkId).toBe(link.id);
    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(link.id, 'active', expect.objectContaining({
      parentUserId: 'p1',
      linkCode: null,
    }));
    expect(notificationRepo.create).toHaveBeenCalledOnce();
  });

  it('parent not found throws NotFoundError', async () => {
    const { useCase, userRepo } = setup();
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ parentUserId: 'nonexistent', linkCode: 'ABC123' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('not a parent role (student) throws ForbiddenError', async () => {
    const { useCase, userRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'student' }));

    await expect(
      useCase.execute({ parentUserId: 'u1', linkCode: 'ABC123' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('invalid code throws NotFoundError when findByCode returns null', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'p1', role: 'parent' }));
    parentLinkRepo.findByCode.mockResolvedValue(null);

    await expect(
      useCase.execute({ parentUserId: 'p1', linkCode: 'INVALID' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('expired code (25 hours ago) throws ExpiredError', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'p1', role: 'parent' }));

    const expiredLink = makeParentLink({
      status: 'pending',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    parentLinkRepo.findByCode.mockResolvedValue(expiredLink);

    await expect(
      useCase.execute({ parentUserId: 'p1', linkCode: 'ABC123' }),
    ).rejects.toThrow(ExpiredError);
  });

  it('link activated with correct data (parentUserId set, linkCode nulled)', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();

    const parentUser = makeUser({ id: 'p1', role: 'parent' });
    const childUser = makeUser({ id: 'c1', role: 'student' });
    const link = makeParentLink({
      childUserId: 'c1',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'p1') return parentUser;
      if (id === 'c1') return childUser;
      return null;
    });
    parentLinkRepo.findByCode.mockResolvedValue(link);

    await useCase.execute({ parentUserId: 'p1', linkCode: link.linkCode! });

    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(
      link.id,
      'active',
      expect.objectContaining({
        parentUserId: 'p1',
        linkedAt: expect.any(String),
        linkCode: null,
      }),
    );
  });

  it('child notification sent with correct type', async () => {
    const { useCase, userRepo, parentLinkRepo, notificationRepo } = setup();

    const parentUser = makeUser({ id: 'p1', role: 'parent' });
    const childUser = makeUser({ id: 'c1', role: 'student' });
    const link = makeParentLink({
      childUserId: 'c1',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    userRepo.findById.mockImplementation(async (id) => {
      if (id === 'p1') return parentUser;
      if (id === 'c1') return childUser;
      return null;
    });
    parentLinkRepo.findByCode.mockResolvedValue(link);

    await useCase.execute({ parentUserId: 'p1', linkCode: link.linkCode! });

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'c1',
        type: 'parent_linked',
      }),
    );
  });
});
