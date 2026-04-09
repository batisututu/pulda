import type { UseCase } from '@/shared/types';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { User } from '@/domain/entities';
import { NotFoundError } from '@/shared/errors';

export interface UpdateUserProfileInput {
  userId: string;
  data: Partial<Pick<User, 'nickname' | 'grade' | 'schoolType' | 'role'>>;
}

/**
 * UpdateUserProfileUseCase - 사용자 프로필 정보를 업데이트한다.
 *
 * userId는 Supabase Auth UUID(auth_id)를 받는다.
 * 내부적으로 auth_id로 users 행을 조회한 뒤 해당 행의 id로 update를 호출한다.
 */
export class UpdateUserProfileUseCase implements UseCase<UpdateUserProfileInput, User> {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<User> {
    const { userId, data } = input;

    // auth_id로 users 테이블 행을 먼저 조회한다.
    // IUserRepository.update는 users.id(PK)를 받으므로 변환이 필요하다.
    const existing = await this.userRepo.findByAuthId(userId);
    if (!existing) {
      throw new NotFoundError('User', userId);
    }

    return this.userRepo.update(existing.id, data);
  }
}
