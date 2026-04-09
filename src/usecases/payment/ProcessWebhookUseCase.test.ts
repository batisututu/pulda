import { ProcessWebhookUseCase } from '@/usecases/payment/ProcessWebhookUseCase';
import { makeSubscription } from '@/__tests__/factories';
import { mockSubscriptionRepository, mockCreditRepository } from '@/__tests__/mockBuilders';
import { mockPaymentGateway } from '@/__tests__/mockGateways';
import { ValidationError } from '@/shared/errors';

describe('ProcessWebhookUseCase', () => {
  const setup = () => {
    const subscriptionRepo = mockSubscriptionRepository();
    const creditRepo = mockCreditRepository();
    const paymentGw = mockPaymentGateway();
    const useCase = new ProcessWebhookUseCase(subscriptionRepo, creditRepo, paymentGw);
    return { useCase, subscriptionRepo, creditRepo, paymentGw };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path (standard): verifies, creates subscription, resets credits', async () => {
    const { useCase, subscriptionRepo, creditRepo, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'standard',
      status: 'success',
      transactionId: 'txn-001',
    });
    subscriptionRepo.findActive.mockResolvedValue(null);

    const result = await useCase.execute({ payload: { raw: 'data' } });

    expect(paymentGw.verifyWebhook).toHaveBeenCalledWith({ raw: 'data' });
    expect(subscriptionRepo.cancel).not.toHaveBeenCalled();
    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        plan: 'standard',
        status: 'active',
        portoneSubscriptionId: 'txn-001',
      }),
    );
    expect(creditRepo.reset).toHaveBeenCalledWith('u1', 'standard');
    expect(result.creditsReset).toBe(true);
    expect(result.subscription).toBeDefined();
  });

  it('happy path (season_pass): creates subscription with 14-day expiry', async () => {
    const { useCase, subscriptionRepo, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'season_pass',
      status: 'success',
      transactionId: 'txn-002',
    });
    subscriptionRepo.findActive.mockResolvedValue(null);

    await useCase.execute({ payload: {} });

    const createCall = subscriptionRepo.create.mock.calls[0][0];
    const startedAt = new Date(createCall.startedAt);
    const expiresAt = new Date(createCall.expiresAt);
    const diffDays = Math.round(
      (expiresAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    expect(diffDays).toBe(14);
  });

  it('throws ValidationError when payment status is failed', async () => {
    const { useCase, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'standard',
      status: 'failed',
      transactionId: 'txn-fail',
    });

    await expect(
      useCase.execute({ payload: {} }),
    ).rejects.toThrow(ValidationError);
  });

  it('cancels existing active subscription before creating new one', async () => {
    const { useCase, subscriptionRepo, paymentGw } = setup();

    const existingSub = makeSubscription({ id: 'old-sub', userId: 'u1', status: 'active' });
    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'premium',
      status: 'success',
      transactionId: 'txn-003',
    });
    subscriptionRepo.findActive.mockResolvedValue(existingSub);

    await useCase.execute({ payload: {} });

    expect(subscriptionRepo.cancel).toHaveBeenCalledWith('old-sub');
    expect(subscriptionRepo.create).toHaveBeenCalledOnce();
  });

  it('skips cancel when no existing subscription', async () => {
    const { useCase, subscriptionRepo, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'standard',
      status: 'success',
      transactionId: 'txn-004',
    });
    subscriptionRepo.findActive.mockResolvedValue(null);

    await useCase.execute({ payload: {} });

    expect(subscriptionRepo.cancel).not.toHaveBeenCalled();
  });

  it('calls creditRepo.reset with correct plan', async () => {
    const { useCase, creditRepo, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'premium',
      status: 'success',
      transactionId: 'txn-005',
    });

    await useCase.execute({ payload: {} });

    expect(creditRepo.reset).toHaveBeenCalledWith('u1', 'premium');
  });

  it('returns creditsReset: true on success', async () => {
    const { useCase, paymentGw } = setup();

    paymentGw.verifyWebhook.mockResolvedValue({
      userId: 'u1',
      plan: 'standard',
      status: 'success',
      transactionId: 'txn-006',
    });

    const result = await useCase.execute({ payload: {} });

    expect(result.creditsReset).toBe(true);
  });
});
