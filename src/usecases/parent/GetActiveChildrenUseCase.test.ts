import { GetActiveChildrenUseCase } from '@/usecases/parent/GetActiveChildrenUseCase';
import { makeParentLink } from '@/__tests__/factories';
import { mockParentLinkRepository } from '@/__tests__/mockBuilders';

describe('GetActiveChildrenUseCase', () => {
  const setup = () => {
    const parentLinkRepo = mockParentLinkRepository();
    const useCase = new GetActiveChildrenUseCase(parentLinkRepo);
    return { useCase, parentLinkRepo };
  };

  it('should return only active children sorted by linkedAt desc', async () => {
    const { useCase, parentLinkRepo } = setup();

    const parentId = 'parent-1';
    const links = [
      makeParentLink({
        parentUserId: parentId,
        status: 'active',
        linkedAt: '2026-01-01T00:00:00Z',
      }),
      makeParentLink({
        parentUserId: parentId,
        status: 'pending',
        linkedAt: null,
      }),
      makeParentLink({
        parentUserId: parentId,
        status: 'active',
        linkedAt: '2026-03-15T00:00:00Z',
      }),
      makeParentLink({
        parentUserId: parentId,
        status: 'revoked',
        linkedAt: '2026-02-01T00:00:00Z',
        revokedAt: '2026-02-10T00:00:00Z',
      }),
    ];

    parentLinkRepo.findByParent.mockResolvedValue(links);

    const result = await useCase.execute({ parentUserId: parentId });

    expect(result.children).toHaveLength(2);
    // 최신순 정렬: 2026-03-15 먼저, 2026-01-01 나중
    expect(result.children[0].linkedAt).toBe('2026-03-15T00:00:00Z');
    expect(result.children[1].linkedAt).toBe('2026-01-01T00:00:00Z');
    // 모두 active 상태
    expect(result.children.every((c) => c.status === 'active')).toBe(true);
  });

  it('should return empty array when no active children', async () => {
    const { useCase, parentLinkRepo } = setup();

    const links = [
      makeParentLink({ status: 'pending' }),
      makeParentLink({ status: 'revoked', revokedAt: '2026-02-01T00:00:00Z' }),
    ];

    parentLinkRepo.findByParent.mockResolvedValue(links);

    const result = await useCase.execute({ parentUserId: 'parent-2' });

    expect(result.children).toEqual([]);
  });

  it('should handle null linkedAt correctly', async () => {
    const { useCase, parentLinkRepo } = setup();

    const links = [
      makeParentLink({
        status: 'active',
        linkedAt: null,
      }),
      makeParentLink({
        status: 'active',
        linkedAt: '2026-04-01T00:00:00Z',
      }),
      makeParentLink({
        status: 'active',
        linkedAt: null,
      }),
    ];

    parentLinkRepo.findByParent.mockResolvedValue(links);

    const result = await useCase.execute({ parentUserId: 'parent-3' });

    expect(result.children).toHaveLength(3);
    // linkedAt이 있는 항목이 먼저, null은 뒤로
    expect(result.children[0].linkedAt).toBe('2026-04-01T00:00:00Z');
    expect(result.children[1].linkedAt).toBeNull();
    expect(result.children[2].linkedAt).toBeNull();
  });
});
