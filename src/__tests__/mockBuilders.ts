import type { IMiniTestRepository } from '@/domain/ports/repositories';
import type { IMiniTestAnswerRepository } from '@/domain/ports/repositories';
import type { IVariantRepository } from '@/domain/ports/repositories';
import type { IFollowRepository } from '@/domain/ports/repositories';
import type { IUserRepository } from '@/domain/ports/repositories';
import type { IParentLinkRepository } from '@/domain/ports/repositories';
import type { INotificationRepository } from '@/domain/ports/repositories';
import type { ICreditRepository } from '@/domain/ports/repositories';
import type { ISharedItemRepository } from '@/domain/ports/repositories';
import type { IExamRepository } from '@/domain/ports/repositories';
import type { IQuestionRepository } from '@/domain/ports/repositories';
import type { IDiagnosisRepository } from '@/domain/ports/repositories';
import type { IBlueprintRepository } from '@/domain/ports/repositories';
import type { ISubscriptionRepository } from '@/domain/ports/repositories';
import type { IFeedbackRepository } from '@/domain/ports/repositories';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

export function mockMiniTestRepository(): Mocked<IMiniTestRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((test) => Promise.resolve({
      ...test,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({
      id,
      ...data,
    })),
  };
}

export function mockMiniTestAnswerRepository(): Mocked<IMiniTestAnswerRepository> {
  return {
    findByTestId: vi.fn().mockResolvedValue([]),
    findByTestIds: vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockImplementation((answers) => Promise.resolve(
      answers.map((a: Record<string, unknown>) => ({
        ...a,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      })),
    )),
  };
}

export function mockVariantRepository(): Mocked<IVariantRepository> {
  return {
    findByDiagnosisId: vi.fn().mockResolvedValue([]),
    findByDiagnosisIds: vi.fn().mockResolvedValue([]),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((variant) => Promise.resolve({
      ...variant,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    createMany: vi.fn().mockImplementation((variants) => Promise.resolve(
      variants.map((v: Record<string, unknown>) => ({
        ...v,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      })),
    )),
  };
}

export function mockFollowRepository(): Mocked<IFollowRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByFollower: vi.fn().mockResolvedValue([]),
    findByFollowing: vi.fn().mockResolvedValue([]),
    findBetween: vi.fn().mockResolvedValue(null),
    findBetweenMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((follow) => Promise.resolve({
      ...follow,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    updateStatus: vi.fn().mockImplementation((id, status) => Promise.resolve({
      id,
      status,
    })),
    delete: vi.fn().mockResolvedValue(undefined),
    countFollowing: vi.fn().mockResolvedValue(0),
  };
}

export function mockUserRepository(): Mocked<IUserRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByAuthId: vi.fn().mockResolvedValue(null),
    findByNickname: vi.fn().mockResolvedValue([]),
    // findByIds는 빈 배열 기본값 — 테스트에서 mockResolvedValue로 재정의
    findByIds: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({
      id,
      ...data,
    })),
  };
}

export function mockParentLinkRepository(): Mocked<IParentLinkRepository> {
  return {
    findByParent: vi.fn().mockResolvedValue([]),
    findByChild: vi.fn().mockResolvedValue([]),
    findByCode: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((link) => Promise.resolve({
      ...link,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    updateStatus: vi.fn().mockImplementation((id, status, extra) => Promise.resolve({
      id,
      status,
      ...extra,
    })),
  };
}

export function mockNotificationRepository(): Mocked<INotificationRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((notification) => Promise.resolve({
      ...notification,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockCreditRepository(): Mocked<ICreditRepository> {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    deduct: vi.fn().mockImplementation((userId, amount) => Promise.resolve({
      id: crypto.randomUUID(),
      userId,
      plan: 'free',
      total: 30,
      used: amount,
      resetAt: new Date().toISOString(),
    })),
    reset: vi.fn().mockImplementation((userId, plan) => Promise.resolve({
      id: crypto.randomUUID(),
      userId,
      plan,
      total: 30,
      used: 0,
      resetAt: new Date().toISOString(),
    })),
    update: vi.fn().mockImplementation((userId, data) => Promise.resolve({
      id: crypto.randomUUID(),
      userId,
      ...data,
    })),
  };
}

export function mockSharedItemRepository(): Mocked<ISharedItemRepository> {
  return {
    findFeed: vi.fn().mockResolvedValue([]),
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((item) => Promise.resolve({
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockExamRepository(): Mocked<IExamRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((exam) => Promise.resolve({
      ...exam,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    update: vi.fn().mockImplementation((id, data) => Promise.resolve({
      id,
      ...data,
    })),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockQuestionRepository(): Mocked<IQuestionRepository> {
  return {
    findByExamId: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((question) => Promise.resolve({
      ...question,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    createMany: vi.fn().mockImplementation((questions) => Promise.resolve(
      questions.map((q: Record<string, unknown>) => ({
        ...q,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      })),
    )),
    updateMany: vi.fn().mockResolvedValue(undefined),
    deleteByExamId: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockDiagnosisRepository(): Mocked<IDiagnosisRepository> {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByQuestionId: vi.fn().mockResolvedValue(null),
    findByExamId: vi.fn().mockResolvedValue([]),
    findByExamIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((diagnosis) => Promise.resolve({
      ...diagnosis,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    createMany: vi.fn().mockImplementation((diagnoses) => Promise.resolve(
      diagnoses.map((d: Record<string, unknown>) => ({
        ...d,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      })),
    )),
  };
}

export function mockBlueprintRepository(): Mocked<IBlueprintRepository> {
  return {
    findByExamId: vi.fn().mockResolvedValue(null),
    findByExamIds: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation((blueprint) => Promise.resolve({
      ...blueprint,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
  };
}

export function mockSubscriptionRepository(): Mocked<ISubscriptionRepository> {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    findActive: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation((sub) => Promise.resolve({
      ...sub,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

export function mockFeedbackRepository(): Mocked<IFeedbackRepository> {
  return {
    findByTarget: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation((feedback) => Promise.resolve({
      ...feedback,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
  };
}
