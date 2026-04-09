const MAX_FOLLOWING = 200;

export function canFollow(currentFollowingCount: number): boolean {
  return currentFollowingCount < MAX_FOLLOWING;
}

/** All accounts are private by default (follow requires approval) */
export const IS_PRIVATE_BY_DEFAULT = true;

export function canSelfFollow(followerId: string, followingId: string): boolean {
  return followerId !== followingId;
}
