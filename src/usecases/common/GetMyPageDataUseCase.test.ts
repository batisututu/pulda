import { GetMyPageDataUseCase } from '@/usecases/common/GetMyPageDataUseCase';
import { makeCredit, makeSubscription } from '@/__tests__/factories';
import { mockCreditRepository, mockSubscriptionRepository } from '@/__tests__/mockBuilders';

describe('GetMyPageDataUseCase', () => {
  const setup = () => {
    const creditRepo = mockCreditRepository();
    const subscriptionRepo = mockSubscriptionRepository();
    const useCase = new GetMyPageDataUseCase(creditRepo, subscriptionRepo);
    return { useCase, creditRepo, subscriptionRepo };
  };

  it('should return both credit and active subscription', async () => {
    const { useCase, creditRepo, subscriptionRepo } = setup();

    const userId = 'user-1';
    const credit = makeCredit({ userId, total: 100, used: 25 });
    const subscription = makeSubscription({ userId, status: 'active', plan: 'premium' });

    creditRepo.findByUserId.mockResolvedValue(credit);
    subscriptionRepo.findActive.mockResolvedValue(subscription);

    const result = await useCase.execute({ userId });

    expect(result.credit).toEqual(credit);
    expect(result.subscription).toEqual(subscription);
    expect(creditRepo.findByUserId).toHaveBeenCalledWith(userId);
    expect(subscriptionRepo.findActive).toHaveBeenCalledWith(userId);
  });

  it('should return null credit when not found', async () => {
    const { useCase, creditRepo, subscriptionRepo } = setup();

    const userId = 'user-2';
    const subscription = makeSubscription({ userId, status: 'active' });

    creditRepo.findByUserId.mockResolvedValue(null);
    subscriptionRepo.findActive.mockResolvedValue(subscription);

    const result = await useCase.execute({ userId });

    expect(result.credit).toBeNull();
    expect(result.subscription).toEqual(subscription);
  });

  it('should return null subscription when no active', async () => {
    const { useCase, creditRepo, subscriptionRepo } = setup();

    const userId = 'user-3';
    const credit = makeCredit({ userId });

    creditRepo.findByUserId.mockResolvedValue(credit);
    subscriptionRepo.findActive.mockResolvedValue(null);

    const result = await useCase.execute({ userId });

    expect(result.credit).toEqual(credit);
    expect(result.subscription).toBeNull();
  });

  it('should handle both null', async () => {
    const { useCase, creditRepo, subscriptionRepo } = setup();

    creditRepo.findByUserId.mockResolvedValue(null);
    subscriptionRepo.findActive.mockResolvedValue(null);

    const result = await useCase.execute({ userId: 'user-4' });

    expect(result.credit).toBeNull();
    expect(result.subscription).toBeNull();
  });
});
