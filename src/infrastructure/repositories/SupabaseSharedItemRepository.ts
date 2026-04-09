import type { SupabaseClient } from '@supabase/supabase-js';
import type { ISharedItemRepository } from '@/domain/ports/repositories/ISharedItemRepository';
import type { SharedItem } from '@/domain/entities';
import type { FeedItem } from '@/domain/entities';
import {
  toDomain,
  toDomainFeedItem,
  toPersistence,
  type SharedItemRow,
  type FeedRow,
} from '@/infrastructure/mappers/SharedItemMapper';
import { repoError } from './_shared/repoError';

export class SupabaseSharedItemRepository implements ISharedItemRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findFeed(
    userId: string,
    options: { page: number; limit: number },
  ): Promise<FeedItem[]> {
    // Step 1: 팔로우 중인 사용자 ID 목록 조회
    const { data: followRows, error: followError } = await this.db
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .eq('status', 'accepted');

    if (followError) {
      throw repoError('SupabaseSharedItemRepository', 'findFeed', followError, { userId });
    }

    const followingIds = (followRows ?? []).map(
      (r: { following_id: string }) => r.following_id,
    );

    // 팔로우 없으면 빈 피드 반환
    if (followingIds.length === 0) return [];

    // Step 2: shared_items + users JOIN으로 작성자 닉네임/아바타를 한 번에 조회
    // Supabase 임베디드 리소스 문법: users!user_id(nickname, avatar_url)
    const from = (options.page - 1) * options.limit;
    const to = from + options.limit - 1;

    const { data, error } = await this.db
      .from('shared_items')
      .select('*, users!user_id(nickname, avatar_url)')
      .in('user_id', followingIds)
      .in('visibility', ['public', 'followers_only'])
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw repoError('SupabaseSharedItemRepository', 'findFeed', error, { userId, page: options.page });

    // Supabase 임베디드 JOIN 결과를 평탄화하여 FeedRow 형태로 변환
    // unknown을 경유하여 Record<string, unknown> → SharedItemRow 타입 단언을 안전하게 처리
    const feedRows = (data ?? []).map((row: Record<string, unknown>) => {
      const usersJoin = row['users'] as { nickname?: string; avatar_url?: string | null } | null;
      return {
        ...(row as unknown as SharedItemRow),
        nickname: usersJoin?.nickname ?? '사용자',
        avatar_url: usersJoin?.avatar_url ?? null,
      } as FeedRow;
    });

    return feedRows.map(toDomainFeedItem);
  }

  async findByUser(userId: string): Promise<SharedItem[]> {
    const { data, error } = await this.db
      .from('shared_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseSharedItemRepository', 'findByUser', error, { userId });
    return (data as SharedItemRow[]).map(toDomain);
  }

  async create(item: Omit<SharedItem, 'id' | 'createdAt'>): Promise<SharedItem> {
    const row = toPersistence(item);

    const { data, error } = await this.db
      .from('shared_items')
      .insert(row)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseSharedItemRepository', 'create', error, { userId: item.userId });
    return toDomain(data as SharedItemRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from('shared_items')
      .delete()
      .eq('id', id);

    if (error) throw repoError('SupabaseSharedItemRepository', 'delete', error, { id });
  }
}
