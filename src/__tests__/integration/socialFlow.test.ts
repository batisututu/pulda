/**
 * E2-4. Social Flow Integration Test
 *
 * Scenarios:
 * 1. Follow request -> accept -> feed shows shared items
 * 2. Self-follow -> ValidationError
 * 3. Following limit exceeded -> ValidationError
 */
import type {
  IFollowRepository,
  IUserRepository,
  INotificationRepository,
  ISharedItemRepository,
} from '@/domain/ports/repositories';
import { ValidationError } from '@/shared/errors';
import { makeUser, makeSharedItem, makeFeedItem } from '@/__tests__/factories';
import {
  mockFollowRepository,
  mockUserRepository,
  mockNotificationRepository,
  mockSharedItemRepository,
} from '@/__tests__/mockBuilders';
import { FollowUserUseCase } from '@/usecases/social/FollowUserUseCase';
import { RespondToFollowUseCase } from '@/usecases/social/RespondToFollowUseCase';
import { GetFeedUseCase } from '@/usecases/social/GetFeedUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

describe('Social Flow (Integration)', () => {
  const followerUserId = 'user-follower-001';
  const followingUserId = 'user-following-002';

  let followRepo: Mocked<IFollowRepository>;
  let userRepo: Mocked<IUserRepository>;
  let notificationRepo: Mocked<INotificationRepository>;
  let sharedItemRepo: Mocked<ISharedItemRepository>;

  let followUseCase: FollowUserUseCase;
  let respondUseCase: RespondToFollowUseCase;
  let getFeedUseCase: GetFeedUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    followRepo = mockFollowRepository();
    userRepo = mockUserRepository();
    notificationRepo = mockNotificationRepository();
    sharedItemRepo = mockSharedItemRepository();

    followUseCase = new FollowUserUseCase(followRepo, userRepo, notificationRepo);
    respondUseCase = new RespondToFollowUseCase(followRepo, notificationRepo);
    getFeedUseCase = new GetFeedUseCase(sharedItemRepo);

    // Both users exist
    userRepo.findById.mockImplementation((id: string) => {
      if (id === followerUserId) {
        return Promise.resolve(makeUser({ id: followerUserId, nickname: 'follower' }));
      }
      if (id === followingUserId) {
        return Promise.resolve(makeUser({ id: followingUserId, nickname: 'following' }));
      }
      return Promise.resolve(null);
    });

    // No existing follow
    followRepo.findBetween.mockResolvedValue(null);

    // Under follow limit
    followRepo.countFollowing.mockResolvedValue(10);
  });

  describe('Success: follow request -> accept -> feed', () => {
    it('sends follow request, accepts it, and shows shared items in feed', async () => {
      // === Step 1: Send follow request ===
      const followResult = await followUseCase.execute({
        followerId: followerUserId,
        followingId: followingUserId,
      });

      expect(followResult.followId).toBeDefined();
      expect(followResult.status).toBe('pending');

      // Follow was created
      expect(followRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          followerId: followerUserId,
          followingId: followingUserId,
          status: 'pending',
        }),
      );

      // Notification sent to target user
      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: followingUserId,
          type: 'follow_request',
        }),
      );

      const followId = followResult.followId;

      // === Step 2: Accept follow request ===
      // Mock: the follow record exists
      followRepo.findById.mockResolvedValue({
        id: followId,
        followerId: followerUserId,
        followingId: followingUserId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const respondResult = await respondUseCase.execute({
        userId: followingUserId,
        followId,
        action: 'accept',
      });

      expect(respondResult.status).toBe('accepted');

      // Follow status updated
      expect(followRepo.updateStatus).toHaveBeenCalledWith(followId, 'accepted');

      // Acceptance notification sent to follower
      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: followerUserId,
          type: 'follow_accepted',
        }),
      );

      // === Step 3: Feed shows shared items from followed user ===
      // findFeed는 FeedItem[]을 반환하므로 makeFeedItem 사용
      const sharedItem = makeFeedItem({
        userId: followingUserId,
        itemType: 'variant_set',
        visibility: 'followers_only',
      });
      sharedItemRepo.findFeed.mockResolvedValue([sharedItem]);

      const feedResult = await getFeedUseCase.execute({
        userId: followerUserId,
        page: 1,
        limit: 10,
      });

      expect(feedResult.items).toHaveLength(1);
      expect(feedResult.items[0].userId).toBe(followingUserId);
      expect(feedResult.items[0].itemType).toBe('variant_set');
      expect(feedResult.hasMore).toBe(false);

      // Feed was queried for the follower user
      expect(sharedItemRepo.findFeed).toHaveBeenCalledWith(
        followerUserId,
        expect.objectContaining({ page: 1, limit: 11 }),
      );
    });
  });

  describe('Failure: self-follow', () => {
    it('throws ValidationError when trying to follow yourself', async () => {
      await expect(
        followUseCase.execute({
          followerId: followerUserId,
          followingId: followerUserId,
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        followUseCase.execute({
          followerId: followerUserId,
          followingId: followerUserId,
        }),
      ).rejects.toThrow(/자기 자신을 팔로우할 수 없습니다/);

      // No follow record created
      expect(followRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('Failure: follow limit exceeded', () => {
    it('throws ValidationError when at maximum following count', async () => {
      // At the limit: 200 following
      followRepo.countFollowing.mockResolvedValue(200);

      await expect(
        followUseCase.execute({
          followerId: followerUserId,
          followingId: followingUserId,
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        followUseCase.execute({
          followerId: followerUserId,
          followingId: followingUserId,
        }),
      ).rejects.toThrow(/최대 팔로우 수/);

      expect(followRepo.create).not.toHaveBeenCalled();
    });

    it('allows follow at count 199 (just under limit)', async () => {
      followRepo.countFollowing.mockResolvedValue(199);

      const result = await followUseCase.execute({
        followerId: followerUserId,
        followingId: followingUserId,
      });

      expect(result.followId).toBeDefined();
      expect(followRepo.create).toHaveBeenCalled();
    });
  });
});
