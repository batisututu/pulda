import type { IExamRepository, ICreditRepository } from '@/domain/ports/repositories';
import type { IStorageGateway } from '@/domain/ports/gateways';
import { InsufficientCreditsError, ValidationError } from '@/shared/errors';
import { MAX_FILE_SIZE } from '@/shared/constants';
import { makeCredit } from '@/__tests__/factories';
import { mockExamRepository, mockCreditRepository } from '@/__tests__/mockBuilders';
import { mockStorageGateway } from '@/__tests__/mockGateways';
import { UploadExamUseCase } from './UploadExamUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

// JPEG magic bytes: FF D8 FF
const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47];

function createTestFile(type: string, magicBytes: number[], size = 1024): File {
  const content = new Uint8Array(size);
  magicBytes.forEach((b, i) => { content[i] = b; });
  return new File([content], 'test.jpg', { type });
}

describe('UploadExamUseCase', () => {
  const userId = 'user-001';

  let examRepo: Mocked<IExamRepository>;
  let creditRepo: Mocked<ICreditRepository>;
  let storageGw: Mocked<IStorageGateway>;
  let useCase: UploadExamUseCase;

  beforeEach(() => {
    vi.clearAllMocks();

    examRepo = mockExamRepository();
    creditRepo = mockCreditRepository();
    storageGw = mockStorageGateway();

    useCase = new UploadExamUseCase(examRepo, creditRepo, storageGw);

    // Default: user has sufficient credits
    creditRepo.findByUserId.mockResolvedValue(
      makeCredit({ userId, total: 30, used: 0 }),
    );
  });

  it('uploads file, creates exam, deducts credit, and returns examId + remainingCredits', async () => {
    const file = createTestFile('image/jpeg', JPEG_MAGIC);

    const result = await useCase.execute({ userId, file });

    expect(result.examId).toBeDefined();
    expect(typeof result.remainingCredits).toBe('number');

    // Storage upload was called
    expect(storageGw.upload).toHaveBeenCalledWith(userId, expect.any(String), file);

    // Exam was created with correct data
    expect(examRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        imageUrl: 'https://storage.example.com/exams/uploaded.jpg',
        ocrResult: null,
        status: 'processing',
      }),
    );

    // Credit was deducted
    expect(creditRepo.deduct).toHaveBeenCalledWith(userId, 1);
  });

  it('throws InsufficientCreditsError when credit record is null', async () => {
    creditRepo.findByUserId.mockResolvedValue(null);
    const file = createTestFile('image/jpeg', JPEG_MAGIC);

    await expect(useCase.execute({ userId, file })).rejects.toThrow(InsufficientCreditsError);
  });

  it('throws InsufficientCreditsError when credits are fully used', async () => {
    creditRepo.findByUserId.mockResolvedValue(
      makeCredit({ userId, total: 30, used: 30 }),
    );
    const file = createTestFile('image/jpeg', JPEG_MAGIC);

    await expect(useCase.execute({ userId, file })).rejects.toThrow(InsufficientCreditsError);
  });

  it('allows upload at boundary: used=29, total=30 (1 remaining)', async () => {
    creditRepo.findByUserId.mockResolvedValue(
      makeCredit({ userId, total: 30, used: 29 }),
    );
    const file = createTestFile('image/jpeg', JPEG_MAGIC);

    const result = await useCase.execute({ userId, file });

    expect(result.examId).toBeDefined();
    expect(creditRepo.deduct).toHaveBeenCalledWith(userId, 1);
  });

  it('throws ValidationError when file size exceeds MAX_FILE_SIZE', async () => {
    const oversizedFile = createTestFile('image/jpeg', JPEG_MAGIC, MAX_FILE_SIZE + 1);

    await expect(useCase.execute({ userId, file: oversizedFile })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ userId, file: oversizedFile })).rejects.toThrow(/File size exceeds/);
  });

  it('throws ValidationError for disallowed file type', async () => {
    const file = createTestFile('text/plain', JPEG_MAGIC, 1024);

    await expect(useCase.execute({ userId, file })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ userId, file })).rejects.toThrow(/Invalid file type/);
  });

  it('throws ValidationError when magic bytes do not match any allowed signature', async () => {
    // Valid MIME type but wrong magic bytes (all zeros)
    const file = createTestFile('image/jpeg', [0x00, 0x00, 0x00], 1024);

    await expect(useCase.execute({ userId, file })).rejects.toThrow(ValidationError);
    await expect(useCase.execute({ userId, file })).rejects.toThrow(/파일 내용이 확장자와 일치하지 않습니다/);
  });

  it('accepts PNG files with correct magic bytes', async () => {
    const file = createTestFile('image/png', PNG_MAGIC);

    const result = await useCase.execute({ userId, file });

    expect(result.examId).toBeDefined();
  });

  it('calls storageGateway.delete when examRepo.create throws (rollback)', async () => {
    const file = createTestFile('image/jpeg', JPEG_MAGIC);
    examRepo.create.mockRejectedValue(new Error('DB error'));

    await expect(useCase.execute({ userId, file })).rejects.toThrow('DB error');

    // Storage upload succeeded but exam creation failed → rollback
    expect(storageGw.upload).toHaveBeenCalled();
    expect(storageGw.delete).toHaveBeenCalledWith('https://storage.example.com/exams/uploaded.jpg');
  });

  it('propagates credit deduction error (exam still exists)', async () => {
    const file = createTestFile('image/jpeg', JPEG_MAGIC);
    creditRepo.deduct.mockRejectedValue(new Error('Credit deduction failed'));

    await expect(useCase.execute({ userId, file })).rejects.toThrow('Credit deduction failed');

    // Exam was created before credit deduction
    expect(examRepo.create).toHaveBeenCalled();
    // Storage delete should NOT be called (no rollback for credit failure)
    expect(storageGw.delete).not.toHaveBeenCalled();
  });
});
