import { UnlinkParentUseCase } from '@/usecases/parent/UnlinkParentUseCase';
import { makeParentLink } from '@/__tests__/factories';
import {
  mockParentLinkRepository,
  mockNotificationRepository,
} from '@/__tests__/mockBuilders';
import { NotFoundError, ForbiddenError, ValidationError } from '@/shared/errors';

describe('UnlinkParentUseCase', () => {
  const setup = () => {
    const parentLinkRepo = mockParentLinkRepository();
    const notificationRepo = mockNotificationRepository();
    const useCase = new UnlinkParentUseCase(parentLinkRepo, notificationRepo);
    return { useCase, parentLinkRepo, notificationRepo };
  };

  const activeLink = makeParentLink({
    id: 'link-1',
    parentUserId: 'parent-1',
    childUserId: 'child-1',
    status: 'active',
    linkedAt: new Date().toISOString(),
  });

  it('parent unlinking: finds via findByParent, revokes, notifies child', async () => {
    const { useCase, parentLinkRepo, notificationRepo } = setup();
    parentLinkRepo.findByParent.mockResolvedValue([activeLink]);
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'parent-1', linkId: 'link-1' });

    expect(result.success).toBe(true);
    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(
      'link-1',
      'revoked',
      expect.objectContaining({ revokedAt: expect.any(String) }),
    );
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'child-1',
        type: 'parent_unlinked',
      }),
    );
  });

  it('child unlinking: finds via findByChild, revokes, notifies parent', async () => {
    const { useCase, parentLinkRepo, notificationRepo } = setup();
    parentLinkRepo.findByParent.mockResolvedValue([]);
    parentLinkRepo.findByChild.mockResolvedValue([activeLink]);

    const result = await useCase.execute({ userId: 'child-1', linkId: 'link-1' });

    expect(result.success).toBe(true);
    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(
      'link-1',
      'revoked',
      expect.objectContaining({ revokedAt: expect.any(String) }),
    );
    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-1',
        type: 'parent_unlinked',
      }),
    );
  });

  it('throws NotFoundError when link not found in either parent or child links', async () => {
    const { useCase, parentLinkRepo } = setup();
    parentLinkRepo.findByParent.mockResolvedValue([]);
    parentLinkRepo.findByChild.mockResolvedValue([]);

    await expect(
      useCase.execute({ userId: 'parent-1', linkId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when user is neither parent nor child', async () => {
    const { useCase, parentLinkRepo } = setup();
    // Link exists but found via parent search of a different user
    // The link's parentUserId and childUserId don't match the requesting user
    const linkWithOtherUsers = makeParentLink({
      id: 'link-2',
      parentUserId: 'other-parent',
      childUserId: 'other-child',
      status: 'active',
    });
    parentLinkRepo.findByParent.mockResolvedValue([linkWithOtherUsers]);
    parentLinkRepo.findByChild.mockResolvedValue([]);

    await expect(
      useCase.execute({ userId: 'intruder', linkId: 'link-2' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ValidationError when link status is not active', async () => {
    const { useCase, parentLinkRepo } = setup();
    const revokedLink = makeParentLink({
      id: 'link-1',
      parentUserId: 'parent-1',
      childUserId: 'child-1',
      status: 'revoked',
    });
    parentLinkRepo.findByParent.mockResolvedValue([revokedLink]);
    parentLinkRepo.findByChild.mockResolvedValue([]);

    await expect(
      useCase.execute({ userId: 'parent-1', linkId: 'link-1' }),
    ).rejects.toThrow(ValidationError);
  });

  it('skips notification when other party is null', async () => {
    const { useCase, parentLinkRepo, notificationRepo } = setup();
    const linkWithNullParent = makeParentLink({
      id: 'link-3',
      parentUserId: null,
      childUserId: 'child-1',
      status: 'active',
    });
    parentLinkRepo.findByParent.mockResolvedValue([]);
    parentLinkRepo.findByChild.mockResolvedValue([linkWithNullParent]);

    const result = await useCase.execute({ userId: 'child-1', linkId: 'link-3' });

    expect(result.success).toBe(true);
    expect(notificationRepo.create).not.toHaveBeenCalled();
  });
});
