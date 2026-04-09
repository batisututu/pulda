import type { SupabaseClient } from '@supabase/supabase-js';
import type { IFollowRepository } from '@/domain/ports/repositories/IFollowRepository';
import type { Follow } from '@/domain/entities';
import type { FollowStatus } from '@/domain/value-objects';
import { toDomain, toPersistence, type FollowRow } from '@/infrastructure/mappers/FollowMapper';
import { repoError } from './_shared/repoError';

export class SupabaseFollowRepository implements IFollowRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Follow | null> {
    const { data, error } = await this.db
      .from('follows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return toDomain(data as FollowRow);
  }

  async findByFollower(followerId: string): Promise<Follow[]> {
    const { data, error } = await this.db
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseFollowRepository', 'findByFollower', error, { followerId });
    return (data as FollowRow[]).map(toDomain);
  }

  async findByFollowing(followingId: string): Promise<Follow[]> {
    const { data, error } = await this.db
      .from('follows')
      .select('*')
      .eq('following_id', followingId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseFollowRepository', 'findByFollowing', error, { followingId });
    return (data as FollowRow[]).map(toDomain);
  }

  async findBetween(followerId: string, followingId: string): Promise<Follow | null> {
    const { data, error } = await this.db
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single();

    if (error || !data) return null;
    return toDomain(data as FollowRow);
  }

  async findBetweenMany(followerId: string, followingIds: string[]): Promise<Follow[]> {
    if (followingIds.length === 0) return [];

    const { data, error } = await this.db
      .from('follows')
      .select('*')
      .eq('follower_id', followerId)
      .in('following_id', followingIds);

    if (error) {
      throw repoError('SupabaseFollowRepository', 'findBetweenMany', error, {
        followerId,
        count: followingIds.length,
      });
    }
    return (data as FollowRow[]).map(toDomain);
  }

  async create(follow: Omit<Follow, 'id' | 'createdAt'>): Promise<Follow> {
    const row = toPersistence(follow);

    const { data, error } = await this.db
      .from('follows')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw repoError('SupabaseFollowRepository', 'create', error, {
        followerId: follow.followerId,
        followingId: follow.followingId,
      });
    }
    return toDomain(data as FollowRow);
  }

  async updateStatus(id: string, status: FollowStatus): Promise<Follow> {
    const { data, error } = await this.db
      .from('follows')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseFollowRepository', 'updateStatus', error, { id, status });
    return toDomain(data as FollowRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db
      .from('follows')
      .delete()
      .eq('id', id);

    if (error) throw repoError('SupabaseFollowRepository', 'delete', error, { id });
  }

  async countFollowing(followerId: string): Promise<number> {
    const { count, error } = await this.db
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', followerId)
      .eq('status', 'accepted');

    if (error) throw repoError('SupabaseFollowRepository', 'countFollowing', error, { followerId });
    return count ?? 0;
  }
}
