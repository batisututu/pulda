/**
 * E2-1. Upload Exam Integration Test
 *
 * Scenarios:
 * 1. Success: sufficient credits -> valid file -> upload -> DB create -> credit deduction
 * 2. Failure: insufficient credits -> InsufficientCreditsError
 * 3. Failure: file too large -> ValidationError
 * 4. Failure: invalid file type -> ValidationError
 */
import type { IExamRepository, ICreditRepository } from '@/domain/ports/repositories';
import type { IStorageGateway } from '@/domain/ports/gateways';
import { InsufficientCreditsError, ValidationError } from '@/shared/errors';
import { MAX_FILE_SIZE } from '@/shared/constants';
import { makeCredit } from '@/__tests__/factories';
import { mockExamRepository, mockCreditRepository } from '@/__tests__/mockBuilders';
import { mockStorageGateway } from '@/__tests__/mockGateways';
import { UploadExamUseCase } from '@/usecases/exam/UploadExamUseCase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mocked<T> = { [K in keyof T]: T[K] & ReturnType<typeof vi.fn> };

// Magic bytes for supported formats
const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47];

function createTestFile(type: string, magicBytes: number[], size = 2048): File {
  const content = new Uint8Array(size);
  magicBytes.forEach((b, i) => { content[i] = b; });
  return new File([content], 'test-exam.jpg', { type });
}

describe('Upload Exam Flow (Integration)', () => {
  const userId = 'user-upload-001';

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
      makeCredit({ userId, total: 30, used: 5 }),
    );
  });

  describe('Success: full upload flow', () => {
    it('uploads file, creates exam record, deducts credit, and returns correct output', async () => {
      const file = createTestFile('image/jpeg', JPEG_MAGIC);

      const result = await useCase.execute({ userId, file });

      // 1. Returns valid examId
      expect(result.examId).toBeDefined();
      expect(typeof result.examId).toBe('string');

      // 2. Returns remaining credits
      expect(typeof result.remainingCredits).toBe('number');

      // 3. Verify the full flow order: credit check -> upload -> create exam -> deduct
      expect(creditRepo.findByUserId).toHaveBeenCalledWith(userId);
      expect(storageGw.upload).toHaveBeenCalledWith(userId, expect.any(String), file);
      expect(examRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          status: 'processing',
          ocrResult: null,
          subject: 'math',
        }),
      );
      expect(creditRepo.deduct).toHaveBeenCalledWith(userId, 1);

      // 4. Verify call order
      const creditCheckOrder = creditRepo.findByUserId.mock.invocationCallOrder[0];
      const uploadOrder = storageGw.upload.mock.invocationCallOrder[0];
      const createOrder = examRepo.create.mock.invocationCallOrder[0];
      const deductOrder = creditRepo.deduct.mock.invocationCallOrder[0];
      expect(creditCheckOrder).toBeLessThan(uploadOrder);
      expect(uploadOrder).toBeLessThan(createOrder);
      expect(createOrder).toBeLessThan(deductOrder);
    });

    it('supports PNG file upload', async () => {
      const file = createTestFile('image/png', PNG_MAGIC);

      const result = await useCase.execute({ userId, file });

      expect(result.examId).toBeDefined();
      expect(storageGw.upload).toHaveBeenCalled();
      expect(examRepo.create).toHaveBeenCalled();
    });
  });

  describe('Failure: insufficient credits', () => {
    it('throws InsufficientCreditsError when credit record is null', async () => {
      creditRepo.findByUserId.mockResolvedValue(null);
      const file = createTestFile('image/jpeg', JPEG_MAGIC);

      await expect(useCase.execute({ userId, file }))
        .rejects.toThrow(InsufficientCreditsError);

      // Should not proceed to upload or create
      expect(storageGw.upload).not.toHaveBeenCalled();
      expect(examRepo.create).not.toHaveBeenCalled();
      expect(creditRepo.deduct).not.toHaveBeenCalled();
    });

    it('throws InsufficientCreditsError when credits fully used', async () => {
      creditRepo.findByUserId.mockResolvedValue(
        makeCredit({ userId, total: 30, used: 30 }),
      );
      const file = createTestFile('image/jpeg', JPEG_MAGIC);

      await expect(useCase.execute({ userId, file }))
        .rejects.toThrow(InsufficientCreditsError);

      expect(storageGw.upload).not.toHaveBeenCalled();
    });
  });

  describe('Failure: file size exceeds limit', () => {
    it('throws ValidationError for oversized file', async () => {
      const oversizedFile = createTestFile('image/jpeg', JPEG_MAGIC, MAX_FILE_SIZE + 1);

      await expect(useCase.execute({ userId, file: oversizedFile }))
        .rejects.toThrow(ValidationError);
      await expect(useCase.execute({ userId, file: oversizedFile }))
        .rejects.toThrow(/File size exceeds/);

      // Credit was checked but upload never happened
      expect(creditRepo.findByUserId).toHaveBeenCalled();
      expect(storageGw.upload).not.toHaveBeenCalled();
    });
  });

  describe('Failure: invalid file type', () => {
    it('throws ValidationError for disallowed MIME type', async () => {
      const file = createTestFile('text/plain', JPEG_MAGIC, 1024);

      await expect(useCase.execute({ userId, file }))
        .rejects.toThrow(ValidationError);
      await expect(useCase.execute({ userId, file }))
        .rejects.toThrow(/Invalid file type/);

      expect(storageGw.upload).not.toHaveBeenCalled();
      expect(examRepo.create).not.toHaveBeenCalled();
    });

    it('throws ValidationError when magic bytes do not match any signature', async () => {
      const file = createTestFile('image/jpeg', [0x00, 0x00, 0x00], 1024);

      await expect(useCase.execute({ userId, file }))
        .rejects.toThrow(ValidationError);
    });
  });
});
