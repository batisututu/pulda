import type { SharedItem } from '@/domain/entities';
import type { FeedItem } from '@/domain/entities';

export interface ISharedItemRepository {
  // 팔로우 중인 사용자들의 피드를 users JOIN으로 작성자 정보를 포함하여 반환
  findFeed(userId: string, options: { page: number; limit: number }): Promise<FeedItem[]>;
  findByUser(userId: string): Promise<SharedItem[]>;
  create(item: Omit<SharedItem, 'id' | 'createdAt'>): Promise<SharedItem>;
  delete(id: string): Promise<void>;
}
