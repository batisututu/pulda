import { CreateMiniTestUseCase } from '@/usecases/minitest/CreateMiniTestUseCase';
import { makeVariantQuestion } from '@/__tests__/factories';
import {
  mockMiniTestRepository,
  mockVariantRepository,
} from '@/__tests__/mockBuilders';
import { ValidationError } from '@/shared/errors';

describe('CreateMiniTestUseCase', () => {
  const setup = () => {
    const miniTestRepo = mockMiniTestRepository();
    const variantRepo = mockVariantRepository();
    const useCase = new CreateMiniTestUseCase(miniTestRepo, variantRepo);
    return { useCase, miniTestRepo, variantRepo };
  };

  it('happy path: valid variantIds, all exist, test created', async () => {
    const { useCase, miniTestRepo, variantRepo } = setup();

    const v1 = makeVariantQuestion({ id: 'v-1' });
    const v2 = makeVariantQuestion({ id: 'v-2' });
    variantRepo.findByIds.mockResolvedValue([v1, v2]);

    const result = await useCase.execute({
      userId: 'u1',
      variantIds: ['v-1', 'v-2'],
    });

    expect(result.test).toBeDefined();
    expect(result.test.userId).toBe('u1');
    expect(miniTestRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        variantIds: ['v-1', 'v-2'],
        score: null,
        totalPoints: null,
        timeSpent: null,
        completedAt: null,
      }),
    );
  });

  it('throws ValidationError for empty variantIds', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', variantIds: [] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for more than 20 variants', async () => {
    const { useCase } = setup();

    const ids = Array.from({ length: 21 }, (_, i) => `v-${i}`);

    await expect(
      useCase.execute({ userId: 'u1', variantIds: ids }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for duplicate IDs', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({ userId: 'u1', variantIds: ['v-1', 'v-1', 'v-2'] }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when some variants do not exist', async () => {
    const { useCase, variantRepo } = setup();

    // Only 1 of 3 found
    const v1 = makeVariantQuestion({ id: 'v-1' });
    variantRepo.findByIds.mockResolvedValue([v1]);

    await expect(
      useCase.execute({ userId: 'u1', variantIds: ['v-1', 'v-2', 'v-3'] }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns created test object', async () => {
    const { useCase, variantRepo } = setup();

    const v1 = makeVariantQuestion({ id: 'v-1' });
    variantRepo.findByIds.mockResolvedValue([v1]);

    const result = await useCase.execute({
      userId: 'u1',
      variantIds: ['v-1'],
    });

    expect(result.test).toHaveProperty('id');
    expect(result.test).toHaveProperty('createdAt');
    expect(result.test.variantIds).toEqual(['v-1']);
  });
});
