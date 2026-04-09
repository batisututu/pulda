import type { FollowStatus } from '../value-objects/FollowStatus';

/**
 * Follow relationship between students for social features.
 */
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: string;              // ISO 8601
}
