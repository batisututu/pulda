import type { Follow } from '@/domain/entities';
import type { FollowStatus } from '@/domain/value-objects';

export interface IFollowRepository {
  findById(id: string): Promise<Follow | null>;
  findByFollower(followerId: string): Promise<Follow[]>;
  findByFollowing(followingId: string): Promise<Follow[]>;
  findBetween(followerId: string, followingId: string): Promise<Follow | null>;
  findBetweenMany(followerId: string, followingIds: string[]): Promise<Follow[]>;
  create(follow: Omit<Follow, 'id' | 'createdAt'>): Promise<Follow>;
  updateStatus(id: string, status: FollowStatus): Promise<Follow>;
  delete(id: string): Promise<void>;
  countFollowing(followerId: string): Promise<number>;
}
