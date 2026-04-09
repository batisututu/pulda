import { SearchUsersUseCase } from '@/usecases/social/SearchUsersUseCase';
import { makeUser, makeFollow } from '@/__tests__/factories';
import {
  mockUserRepository,
  mockFollowRepository,
} from '@/__tests__/mockBuilders';
import { ValidationError } from '@/shared/errors';

describe('SearchUsersUseCase', () => {
  const setup = () => {
    const userRepo = mockUserRepository();
    const followRepo = mockFollowRepository();
    const useCase = new SearchUsersUseCase(userRepo, followRepo);
    return { useCase, userRepo, followRepo };
  };

  it('happy path: finds users, excludes self, enriches with follow status', async () => {
    const { useCase, userRepo, followRepo } = setup();

    const otherUser = makeUser({ id: 'other-1', nickname: 'mathpro', avatarUrl: null, grade: 'high1' });
    const selfUser = makeUser({ id: 'me', nickname: 'mathme' });
    userRepo.findByNickname.mockResolvedValue([otherUser, selfUser]);

    const follow = makeFollow({ id: 'f1', followerId: 'me', followingId: 'other-1', status: 'accepted' });
    followRepo.findBetweenMany.mockResolvedValue([follow]);

    const result = await useCase.execute({ userId: 'me', query: 'math', limit: 10 });

    expect(result.users).toHaveLength(1);
    expect(result.users[0].id).toBe('other-1');
    expect(result.users[0].followStatus).toBe('accepted');
    expect(result.users[0].followId).toBe('f1');
  });

  it('throws ValidationError for query length < 2', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'me', query: 'a' }),
    ).rejects.toThrow(ValidationError);
  });

  it('caps results at limit', async () => {
    const { useCase, userRepo, followRepo } = setup();

    const users = Array.from({ length: 5 }, (_, i) =>
      makeUser({ id: `u-${i}`, nickname: `student${i}` }),
    );
    userRepo.findByNickname.mockResolvedValue(users);
    followRepo.findBetweenMany.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'me', query: 'student', limit: 3 });

    expect(result.users).toHaveLength(3);
  });

  it('excludes searching user from results', async () => {
    const { useCase, userRepo, followRepo } = setup();

    const selfUser = makeUser({ id: 'me', nickname: 'mathme' });
    const otherUser = makeUser({ id: 'other-1', nickname: 'mathpro' });
    userRepo.findByNickname.mockResolvedValue([selfUser, otherUser]);
    followRepo.findBetweenMany.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'me', query: 'math' });

    expect(result.users.every((u) => u.id !== 'me')).toBe(true);
    expect(result.users).toHaveLength(1);
  });

  it('returns null followStatus when no relationship exists', async () => {
    const { useCase, userRepo, followRepo } = setup();

    const otherUser = makeUser({ id: 'other-1', nickname: 'mathpro' });
    userRepo.findByNickname.mockResolvedValue([otherUser]);
    followRepo.findBetweenMany.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'me', query: 'math' });

    expect(result.users[0].followStatus).toBeNull();
    expect(result.users[0].followId).toBeNull();
  });

  it('returns existing followStatus and followId when relationship exists', async () => {
    const { useCase, userRepo, followRepo } = setup();

    const otherUser = makeUser({ id: 'other-1', nickname: 'mathpro' });
    userRepo.findByNickname.mockResolvedValue([otherUser]);

    const follow = makeFollow({ id: 'f-99', followerId: 'me', followingId: 'other-1', status: 'pending' });
    followRepo.findBetweenMany.mockResolvedValue([follow]);

    const result = await useCase.execute({ userId: 'me', query: 'math' });

    expect(result.users[0].followStatus).toBe('pending');
    expect(result.users[0].followId).toBe('f-99');
  });
});
