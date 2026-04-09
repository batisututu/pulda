import type { UseCase } from '@/shared/types';
import type { ParentLink } from '@/domain/entities';
import type { IParentLinkRepository } from '@/domain/ports/repositories';

export interface GetActiveChildrenInput {
  parentUserId: string;
}

export interface GetActiveChildrenOutput {
  children: ParentLink[];
}

/**
 * GetActiveChildrenUseCase - Fetches active parent-child links for a parent.
 *
 * Loads all links for the parent, filters to active only, and sorts
 * by linkedAt descending (most recent first, null at end).
 */
export class GetActiveChildrenUseCase
  implements UseCase<GetActiveChildrenInput, GetActiveChildrenOutput>
{
  constructor(
    private readonly parentLinkRepo: IParentLinkRepository,
  ) {}

  async execute(input: GetActiveChildrenInput): Promise<GetActiveChildrenOutput> {
    const { parentUserId } = input;

    // 1. 부모 ID로 모든 링크 조회
    const allLinks = await this.parentLinkRepo.findByParent(parentUserId);

    // 2. 활성 상태만 필터링
    const activeLinks = allLinks.filter((link) => link.status === 'active');

    // 3. linkedAt 기준 내림차순 정렬 (null은 맨 뒤로)
    activeLinks.sort((a, b) => {
      if (a.linkedAt === null && b.linkedAt === null) return 0;
      if (a.linkedAt === null) return 1;
      if (b.linkedAt === null) return -1;
      return new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime();
    });

    return { children: activeLinks };
  }
}
