import type { User } from '@/domain/entities';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByAuthId(authId: string): Promise<User | null>;
  findByNickname(query: string, limit?: number): Promise<User[]>;
  // 여러 ID로 사용자 일괄 조회 (GetPendingFollowsUseCase 등에서 닉네임 해소에 사용)
  findByIds(ids: string[]): Promise<User[]>;
  update(id: string, data: Partial<User>): Promise<User>;
}
