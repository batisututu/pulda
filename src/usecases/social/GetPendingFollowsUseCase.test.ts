import { GetPendingFollowsUseCase } from '@/usecases/social/GetPendingFollowsUseCase';
import { mockFollowRepository, mockUserRepository } from '@/__tests__/mockBuilders';
import { makeFollow, makeUser } from '@/__tests__/factories';

describe('GetPendingFollowsUseCase', () => {
  const setup = () => {
    const followRepo = mockFollowRepository();
    const userRepo = mockUserRepository();
    const useCase = new GetPendingFollowsUseCase(followRepo, userRepo);
    return { useCase, followRepo, userRepo };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pending follows with resolved nicknames', async () => {
    const { useCase, followRepo, userRepo } = setup();

    const follows = [
      makeFollow({ id: 'f1', followerId: 'u-a', followingId: 'me', status: 'pending', createdAt: '2026-01-01T00:00:00Z' }),
      makeFollow({ id: 'f2', followerId: 'u-b', followingId: 'me', status: 'pending', createdAt: '2026-01-02T00:00:00Z' }),
      // accepted 상태는 필터링되어야 한다
      makeFollow({ id: 'f3', followerId: 'u-c', followingId: 'me', status: 'accepted' }),
    ];
    followRepo.findByFollowing.mockResolvedValue(follows);

    const users = [
      makeUser({ id: 'u-a', nickname: 'Alice' }),
      makeUser({ id: 'u-b', nickname: 'Bob' }),
    ];
    userRepo.findByIds.mockResolvedValue(users);

    const result = await useCase.execute({ userId: 'me' });

    expect(result.pendingFollows).toHaveLength(2);
    expect(result.pendingFollows[0]).toEqual({
      id: 'f1',
      followerId: 'u-a',
      followerNickname: 'Alice',
      createdAt: '2026-01-01T00:00:00Z',
    });
    expect(result.pendingFollows[1]).toEqual({
      id: 'f2',
      followerId: 'u-b',
      followerNickname: 'Bob',
      createdAt: '2026-01-02T00:00:00Z',
    });

    // findByIds는 pending 팔로워 ID만 받아야 한다
    expect(userRepo.findByIds).toHaveBeenCalledWith(['u-a', 'u-b']);
  });

  it('returns empty array when no pending follows exist', async () => {
    const { useCase, followRepo, userRepo } = setup();

    // 모든 팔로우가 accepted 상태
    followRepo.findByFollowing.mockResolvedValue([
      makeFollow({ status: 'accepted' }),
    ]);

    const result = await useCase.execute({ userId: 'me' });

    expect(result.pendingFollows).toEqual([]);
    // pending이 없으면 사용자 조회를 하지 않는다
    expect(userRepo.findByIds).not.toHaveBeenCalled();
  });

  it('returns empty array when no follows at all', async () => {
    const { useCase, followRepo, userRepo } = setup();

    followRepo.findByFollowing.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'me' });

    expect(result.pendingFollows).toEqual([]);
    expect(userRepo.findByIds).not.toHaveBeenCalled();
  });

  it('uses default nickname when user is not found', async () => {
    const { useCase, followRepo, userRepo } = setup();

    // 팔로워 u-x의 프로필을 조회할 수 없는 경우
    followRepo.findByFollowing.mockResolvedValue([
      makeFollow({ id: 'f-unknown', followerId: 'u-x', followingId: 'me', status: 'pending', createdAt: '2026-03-01T00:00:00Z' }),
    ]);
    // findByIds가 빈 배열을 반환 (삭제된 사용자 등)
    userRepo.findByIds.mockResolvedValue([]);

    const result = await useCase.execute({ userId: 'me' });

    expect(result.pendingFollows).toHaveLength(1);
    // 닉네임을 찾을 수 없으면 '사용자' 기본값
    expect(result.pendingFollows[0].followerNickname).toBe('사용자');
  });

  it('handles mixed found and not-found users', async () => {
    const { useCase, followRepo, userRepo } = setup();

    followRepo.findByFollowing.mockResolvedValue([
      makeFollow({ id: 'f1', followerId: 'found-user', followingId: 'me', status: 'pending', createdAt: '2026-01-01T00:00:00Z' }),
      makeFollow({ id: 'f2', followerId: 'missing-user', followingId: 'me', status: 'pending', createdAt: '2026-01-02T00:00:00Z' }),
    ]);

    // found-user만 존재, missing-user는 findByIds 결과에 없음
    userRepo.findByIds.mockResolvedValue([
      makeUser({ id: 'found-user', nickname: 'FoundNick' }),
    ]);

    const result = await useCase.execute({ userId: 'me' });

    expect(result.pendingFollows[0].followerNickname).toBe('FoundNick');
    expect(result.pendingFollows[1].followerNickname).toBe('사용자');
  });
});
