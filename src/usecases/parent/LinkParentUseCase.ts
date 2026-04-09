import type { UseCase } from '@/shared/types';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { IParentLinkRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import { ForbiddenError, NotFoundError, ExpiredError } from '@/shared/errors';
import { isCodeExpired } from '@/domain/rules/linkCodeRules';

export interface LinkParentInput {
  parentUserId: string;
  linkCode: string;
}

export interface LinkParentOutput {
  linkId: string;
  childUserId: string;
  childNickname: string;
  status: 'active';
}

export class LinkParentUseCase implements UseCase<LinkParentInput, LinkParentOutput> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly parentLinkRepo: IParentLinkRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(input: LinkParentInput): Promise<LinkParentOutput> {
    const { parentUserId, linkCode } = input;

    // 1. Load parent user and verify role
    const parentUser = await this.userRepo.findById(parentUserId);
    if (!parentUser) {
      throw new NotFoundError('User', parentUserId);
    }
    if (parentUser.role !== 'parent') {
      throw new ForbiddenError('학부모 계정만 연동할 수 있습니다');
    }

    // 2. Find link by code
    const link = await this.parentLinkRepo.findByCode(linkCode.toUpperCase());
    if (!link || link.status !== 'pending') {
      throw new NotFoundError('Link code');
    }

    // 3. Check expiry
    if (isCodeExpired(new Date(link.createdAt))) {
      throw new ExpiredError('Link code');
    }

    // 4. Activate link
    await this.parentLinkRepo.updateStatus(link.id, 'active', {
      parentUserId,
      linkedAt: new Date().toISOString(),
      linkCode: null,
    });

    // 5. Load child user info
    const childUser = await this.userRepo.findById(link.childUserId);

    // 6. Notify child
    await this.notificationRepo.create({
      userId: link.childUserId,
      type: 'parent_linked',
      title: '학부모 연동 완료',
      body: '학부모 계정이 연결되었습니다.',
      isRead: false,
      data: { parentId: parentUserId, linkId: link.id },
    });

    return {
      linkId: link.id,
      childUserId: link.childUserId,
      childNickname: childUser?.nickname ?? '',
      status: 'active',
    };
  }
}
