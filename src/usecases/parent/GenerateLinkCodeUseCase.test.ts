import { GenerateLinkCodeUseCase } from '@/usecases/parent/GenerateLinkCodeUseCase';
import { makeUser, makeParentLink } from '@/__tests__/factories';
import {
  mockUserRepository,
  mockParentLinkRepository,
} from '@/__tests__/mockBuilders';
import { ForbiddenError } from '@/shared/errors';

describe('GenerateLinkCodeUseCase', () => {
  const setup = () => {
    const userRepo = mockUserRepository();
    const parentLinkRepo = mockParentLinkRepository();
    const useCase = new GenerateLinkCodeUseCase(userRepo, parentLinkRepo);
    return { useCase, userRepo, parentLinkRepo };
  };

  it('happy path: student generates code, returns 6-char code + expiresAt', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'student' }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.linkCode).toHaveLength(6);
    expect(result.expiresAt).toBeDefined();

    // expiresAt should be ~24 hours from now
    const expiresMs = new Date(result.expiresAt).getTime();
    const nowMs = Date.now();
    const hoursDiff = (expiresMs - nowMs) / (1000 * 60 * 60);
    expect(hoursDiff).toBeGreaterThan(23);
    expect(hoursDiff).toBeLessThanOrEqual(24);

    expect(parentLinkRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        childUserId: 'u1',
        parentUserId: null,
        status: 'pending',
      }),
    );
  });

  it('user not found throws ForbiddenError', async () => {
    const { useCase, userRepo } = setup();
    userRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'nonexistent' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('parent role throws ForbiddenError', async () => {
    const { useCase, userRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'parent' }));

    await expect(
      useCase.execute({ userId: 'u1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('existing pending links revoked (2 pending + 1 active -> only 2 revoked)', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'student' }));

    const pending1 = makeParentLink({ status: 'pending', childUserId: 'u1' });
    const pending2 = makeParentLink({ status: 'pending', childUserId: 'u1' });
    const active = makeParentLink({ status: 'active', childUserId: 'u1', parentUserId: 'p1' });
    parentLinkRepo.findByChild.mockResolvedValue([pending1, pending2, active]);

    await useCase.execute({ userId: 'u1' });

    expect(parentLinkRepo.updateStatus).toHaveBeenCalledTimes(2);
    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(
      pending1.id,
      'revoked',
      expect.objectContaining({ revokedAt: expect.any(String) }),
    );
    expect(parentLinkRepo.updateStatus).toHaveBeenCalledWith(
      pending2.id,
      'revoked',
      expect.objectContaining({ revokedAt: expect.any(String) }),
    );
  });

  it('no existing links works fine', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'student' }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.linkCode).toBeDefined();
    expect(parentLinkRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('code format: 6 chars from allowed set (no 0, O, 1, I)', async () => {
    const { useCase, userRepo, parentLinkRepo } = setup();
    userRepo.findById.mockResolvedValue(makeUser({ id: 'u1', role: 'student' }));
    parentLinkRepo.findByChild.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.linkCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
