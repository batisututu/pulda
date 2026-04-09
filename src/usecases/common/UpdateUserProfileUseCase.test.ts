import { UpdateUserProfileUseCase } from '@/usecases/common/UpdateUserProfileUseCase';
import { mockUserRepository } from '@/__tests__/mockBuilders';
import { makeUser } from '@/__tests__/factories';
import { NotFoundError } from '@/shared/errors';

describe('UpdateUserProfileUseCase', () => {
  const setup = () => {
    const userRepo = mockUserRepository();
    const useCase = new UpdateUserProfileUseCase(userRepo);
    return { useCase, userRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: updates nickname and returns updated user', async () => {
    const { useCase, userRepo } = setup();

    const existing = makeUser({ id: 'user-pk-1', authId: 'auth-uuid-1', nickname: 'old' });
    userRepo.findByAuthId.mockResolvedValue(existing);

    const updatedUser = makeUser({ id: 'user-pk-1', authId: 'auth-uuid-1', nickname: 'newname' });
    userRepo.update.mockResolvedValue(updatedUser);

    const result = await useCase.execute({
      userId: 'auth-uuid-1',
      data: { nickname: 'newname' },
    });

    expect(result.nickname).toBe('newname');
    // findByAuthId는 auth_id(UUID)로 호출
    expect(userRepo.findByAuthId).toHaveBeenCalledWith('auth-uuid-1');
    // update는 users.id(PK)로 호출
    expect(userRepo.update).toHaveBeenCalledWith('user-pk-1', { nickname: 'newname' });
  });

  it('happy path: updates grade and schoolType together', async () => {
    const { useCase, userRepo } = setup();

    const existing = makeUser({ id: 'pk-2', authId: 'auth-2' });
    userRepo.findByAuthId.mockResolvedValue(existing);

    const updatedUser = makeUser({ id: 'pk-2', authId: 'auth-2', grade: 'high2', schoolType: 'high' });
    userRepo.update.mockResolvedValue(updatedUser);

    const result = await useCase.execute({
      userId: 'auth-2',
      data: { grade: 'high2', schoolType: 'high' },
    });

    expect(result.grade).toBe('high2');
    expect(result.schoolType).toBe('high');
    expect(userRepo.update).toHaveBeenCalledWith('pk-2', { grade: 'high2', schoolType: 'high' });
  });

  it('happy path: updates role field', async () => {
    const { useCase, userRepo } = setup();

    const existing = makeUser({ id: 'pk-3', authId: 'auth-3', role: 'student' });
    userRepo.findByAuthId.mockResolvedValue(existing);

    const updatedUser = makeUser({ id: 'pk-3', authId: 'auth-3', role: 'parent' });
    userRepo.update.mockResolvedValue(updatedUser);

    const result = await useCase.execute({
      userId: 'auth-3',
      data: { role: 'parent' },
    });

    expect(result.role).toBe('parent');
  });

  it('throws NotFoundError when user does not exist', async () => {
    const { useCase, userRepo } = setup();

    userRepo.findByAuthId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'nonexistent-auth-id',
        data: { nickname: 'anything' },
      }),
    ).rejects.toThrow(NotFoundError);

    // update는 호출되지 않아야 한다
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('passes empty data object through to repository', async () => {
    const { useCase, userRepo } = setup();

    const existing = makeUser({ id: 'pk-4', authId: 'auth-4' });
    userRepo.findByAuthId.mockResolvedValue(existing);
    userRepo.update.mockResolvedValue(existing);

    await useCase.execute({
      userId: 'auth-4',
      data: {},
    });

    // 빈 객체도 repository에 전달된다
    expect(userRepo.update).toHaveBeenCalledWith('pk-4', {});
  });
});
