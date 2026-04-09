import type { UseCase } from '@/shared/types';
import type { IParentLinkRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors';

export interface UnlinkParentInput {
  userId: string;
  linkId: string;
}

export interface UnlinkParentOutput {
  success: boolean;
}

export class UnlinkParentUseCase implements UseCase<UnlinkParentInput, UnlinkParentOutput> {
  constructor(
    private readonly parentLinkRepo: IParentLinkRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: UnlinkParentInput): Promise<UnlinkParentOutput> {
    const { userId, linkId } = input;

    // 1. Find the link by searching both parent and child links
    const parentLinks = await this.parentLinkRepo.findByParent(userId);
    const childLinks = await this.parentLinkRepo.findByChild(userId);
    const allLinks = [...parentLinks, ...childLinks];
    const link = allLinks.find((l) => l.id === linkId);

    if (!link) {
      throw new NotFoundError('ParentLink', linkId);
    }

    // 2. Verify user is either parent or child
    if (link.parentUserId !== userId && link.childUserId !== userId) {
      throw new ForbiddenError('이 연동을 해제할 권한이 없습니다');
    }

    // 3. Verify link is currently active
    if (link.status !== 'active') {
      throw new ValidationError('활성 상태의 연동만 해제할 수 있습니다');
    }

    // 4. Revoke the link
    await this.parentLinkRepo.updateStatus(linkId, 'revoked', {
      revokedAt: new Date().toISOString(),
    });

    // 5. Notify the other party
    const otherUserId = link.parentUserId === userId
      ? link.childUserId
      : link.parentUserId;

    if (otherUserId) {
      await this.notificationRepo.create({
        userId: otherUserId,
        type: 'parent_unlinked',
        title: '학부모 연동 해제',
        body: '학부모 연동이 해제되었습니다.',
        isRead: false,
        data: { linkId },
      });
    }

    return { success: true };
  }
}
