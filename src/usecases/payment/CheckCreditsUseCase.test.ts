import { CheckCreditsUseCase } from '@/usecases/payment/CheckCreditsUseCase';
import { makeCredit } from '@/__tests__/factories';
import { mockCreditRepository } from '@/__tests__/mockBuilders';
import { NotFoundError } from '@/shared/errors';

describe('CheckCreditsUseCase', () => {
  const setup = () => {
    const creditRepo = mockCreditRepository();
    const useCase = new CheckCreditsUseCase(creditRepo);
    return { useCase, creditRepo };
  };

  it('happy path (no reset needed): returns correct values', async () => {
    const { useCase, creditRepo } = setup();
    const futureReset = new Date();
    futureReset.setMonth(futureReset.getMonth() + 1);

    const credit = makeCredit({
      userId: 'u1',
      plan: 'standard',
      total: 150,
      used: 30,
      resetAt: futureReset.toISOString(),
    });
    creditRepo.findByUserId.mockResolvedValue(credit);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.total).toBe(150);
    expect(result.used).toBe(30);
    expect(result.remaining).toBe(120);
    expect(result.plan).toBe('standard');
    expect(result.resetAt).toBe(futureReset.toISOString());
    expect(creditRepo.reset).not.toHaveBeenCalled();
  });

  it('credit not found throws NotFoundError', async () => {
    const { useCase, creditRepo } = setup();
    creditRepo.findByUserId.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'nonexistent' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('reset due (resetAt in past): creditRepo.reset called, returns reset credit', async () => {
    const { useCase, creditRepo } = setup();
    const pastReset = new Date(Date.now() - 1000).toISOString();

    const credit = makeCredit({
      userId: 'u1',
      plan: 'free',
      total: 30,
      used: 25,
      resetAt: pastReset,
    });
    creditRepo.findByUserId.mockResolvedValue(credit);

    const futureReset = new Date();
    futureReset.setMonth(futureReset.getMonth() + 1);
    creditRepo.reset.mockResolvedValue({
      id: credit.id,
      userId: 'u1',
      plan: 'free',
      total: 30,
      used: 0,
      resetAt: futureReset.toISOString(),
    });

    const result = await useCase.execute({ userId: 'u1' });

    expect(creditRepo.reset).toHaveBeenCalledWith('u1', 'free');
    expect(result.used).toBe(0);
    expect(result.remaining).toBe(30);
  });

  it('remaining calculation: total:30, used:12 -> remaining:18', async () => {
    const { useCase, creditRepo } = setup();
    const futureReset = new Date();
    futureReset.setMonth(futureReset.getMonth() + 1);

    const credit = makeCredit({
      userId: 'u1',
      total: 30,
      used: 12,
      resetAt: futureReset.toISOString(),
    });
    creditRepo.findByUserId.mockResolvedValue(credit);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.remaining).toBe(18);
  });

  it('plan and resetAt included in output', async () => {
    const { useCase, creditRepo } = setup();
    const futureReset = new Date();
    futureReset.setMonth(futureReset.getMonth() + 1);
    const resetAtStr = futureReset.toISOString();

    const credit = makeCredit({
      userId: 'u1',
      plan: 'premium',
      total: 400,
      used: 100,
      resetAt: resetAtStr,
    });
    creditRepo.findByUserId.mockResolvedValue(credit);

    const result = await useCase.execute({ userId: 'u1' });

    expect(result.plan).toBe('premium');
    expect(result.resetAt).toBe(resetAtStr);
  });
});
