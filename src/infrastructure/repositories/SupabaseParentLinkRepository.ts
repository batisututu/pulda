import type { SupabaseClient } from '@supabase/supabase-js';
import type { IParentLinkRepository } from '@/domain/ports/repositories/IParentLinkRepository';
import type { ParentLink } from '@/domain/entities';
import { toDomain, toPersistence, type ParentLinkRow } from '@/infrastructure/mappers/ParentLinkMapper';
import { repoError } from './_shared/repoError';

export class SupabaseParentLinkRepository implements IParentLinkRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByParent(parentUserId: string): Promise<ParentLink[]> {
    const { data, error } = await this.db
      .from('parent_links')
      .select('*')
      .eq('parent_user_id', parentUserId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseParentLinkRepository', 'findByParent', error, { parentUserId });
    return (data as ParentLinkRow[]).map(toDomain);
  }

  async findByChild(childUserId: string): Promise<ParentLink[]> {
    const { data, error } = await this.db
      .from('parent_links')
      .select('*')
      .eq('child_user_id', childUserId)
      .order('created_at', { ascending: false });

    if (error) throw repoError('SupabaseParentLinkRepository', 'findByChild', error, { childUserId });
    return (data as ParentLinkRow[]).map(toDomain);
  }

  async findByCode(code: string): Promise<ParentLink | null> {
    const { data, error } = await this.db
      .from('parent_links')
      .select('*')
      .eq('link_code', code)
      .single();

    if (error || !data) return null;
    return toDomain(data as ParentLinkRow);
  }

  async create(link: Omit<ParentLink, 'id' | 'createdAt'>): Promise<ParentLink> {
    const row = toPersistence(link);

    const { data, error } = await this.db
      .from('parent_links')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw repoError('SupabaseParentLinkRepository', 'create', error, {
        childUserId: link.childUserId,
      });
    }
    return toDomain(data as ParentLinkRow);
  }

  async updateStatus(
    id: string,
    status: string,
    extraData?: Partial<ParentLink>,
  ): Promise<ParentLink> {
    const updates: Record<string, unknown> = { status };

    if (extraData) {
      const extra = toPersistence(extraData);
      Object.assign(updates, extra);
    }

    const { data, error } = await this.db
      .from('parent_links')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw repoError('SupabaseParentLinkRepository', 'updateStatus', error, { id, status });
    return toDomain(data as ParentLinkRow);
  }
}
