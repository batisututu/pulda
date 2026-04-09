import { CreateSubscriptionUseCase } from '@/usecases/payment/CreateSubscriptionUseCase';
import { makeSubscription } from '@/__tests__/factories';
import { mockSubscriptionRepository } from '@/__tests__/mockBuilders';
import { mockPaymentGateway } from '@/__tests__/mockGateways';
import { ValidationError } from '@/shared/errors';

describe('CreateSubscriptionUseCase', () => {
  const setup = () => {
    const subscriptionRepo = mockSubscriptionRepository();
    const paymentGw = mockPaymentGateway();
    const useCase = new CreateSubscriptionUseCase(subscriptionRepo, paymentGw);
    return { useCase, subscriptionRepo, paymentGw };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: standard plan with no existing subscription returns session', async () => {
    const { useCase, subscriptionRepo, paymentGw } = setup();
    subscriptionRepo.findActive.mockResolvedValue(null);
    paymentGw.createSession.mockResolvedValue({
      sessionId: 'session-abc',
      redirectUrl: 'https://pay.example.com/session-abc',
    });

    const result = await useCase.execute({ userId: 'u1', plan: 'standard' });

    expect(result.sessionId).toBe('session-abc');
    expect(result.redirectUrl).toBe('https://pay.example.com/session-abc');
    expect(paymentGw.createSession).toHaveBeenCalledWith('u1', 'standard');
  });

  it('throws ValidationError for free plan', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', plan: 'free' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for parent plan', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', plan: 'parent' }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when active subscription already exists', async () => {
    const { useCase, subscriptionRepo } = setup();
    subscriptionRepo.findActive.mockResolvedValue(
      makeSubscription({ userId: 'u1', status: 'active' }),
    );

    await expect(
      useCase.execute({ userId: 'u1', plan: 'standard' }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns sessionId and redirectUrl from payment gateway', async () => {
    const { useCase, subscriptionRepo, paymentGw } = setup();
    subscriptionRepo.findActive.mockResolvedValue(null);
    paymentGw.createSession.mockResolvedValue({
      sessionId: 'sess-xyz',
      redirectUrl: 'https://checkout.example.com/sess-xyz',
    });

    const result = await useCase.execute({ userId: 'u1', plan: 'premium' });

    expect(result).toEqual({
      sessionId: 'sess-xyz',
      redirectUrl: 'https://checkout.example.com/sess-xyz',
    });
  });
});
