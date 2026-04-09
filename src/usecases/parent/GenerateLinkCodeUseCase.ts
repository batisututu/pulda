import type { UseCase } from '@/shared/types';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { IParentLinkRepository } from '@/domain/ports/repositories';
import { ForbiddenError } from '@/shared/errors';
import { generateLinkCode } from '@/domain/rules/linkCodeRules';

export interface GenerateLinkCodeInput {
  userId: string;
}

export interface GenerateLinkCodeOutput {
  linkCode: string;
  expiresAt: string;
}

export class GenerateLinkCodeUseCase implements UseCase<GenerateLinkCodeInput, GenerateLinkCodeOutput> {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly parentLinkRepo: IParentLinkRepository,
  ) {}

  async execute(input: GenerateLinkCodeInput): Promise<GenerateLinkCodeOutput> {
    const { userId } = input;

    // 1. Load user and verify role is student
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new ForbiddenError('사용자를 찾을 수 없습니다');
    }
    if (user.role === 'parent') {
      throw new ForbiddenError('학부모 계정은 연동 코드를 생성할 수 없습니다');
    }

    // 2. Invalidate existing pending links
    const existingLinks = await this.parentLinkRepo.findByChild(userId);
    const pendingLinks = existingLinks.filter((link) => link.status === 'pending');
    for (const link of pendingLinks) {
      await this.parentLinkRepo.updateStatus(link.id, 'revoked', {
        revokedAt: new Date().toISOString(),
      });
    }

    // 3. Generate new link code
    const code = generateLinkCode();

    // 4. Create new pending link (parentUserId is null until parent claims the code)
    const createdLink = await this.parentLinkRepo.create({
      parentUserId: null,
      childUserId: userId,
      linkCode: code,
      status: 'pending',
      linkedAt: null,
      revokedAt: null,
    });

    // 5. Return code with expiry (24 hours from DB createdAt)
    const expiresAt = new Date(
      new Date(createdLink.createdAt).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();

    return { linkCode: code, expiresAt };
  }
}
