import type { ParentLink } from '@/domain/entities';

export interface IParentLinkRepository {
  findByParent(parentUserId: string): Promise<ParentLink[]>;
  findByChild(childUserId: string): Promise<ParentLink[]>;
  findByCode(code: string): Promise<ParentLink | null>;
  create(link: Omit<ParentLink, 'id' | 'createdAt'>): Promise<ParentLink>;
  updateStatus(id: string, status: string, extraData?: Partial<ParentLink>): Promise<ParentLink>;
}
