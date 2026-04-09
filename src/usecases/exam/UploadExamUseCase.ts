import type { UseCase } from '@/shared/types';
import type { IExamRepository, ICreditRepository } from '@/domain/ports/repositories';
import type { IStorageGateway } from '@/domain/ports/gateways';
import { hasSufficientCredits, getRemainingCredits } from '@/domain/rules/creditRules';
import { getExpiryDate } from '@/domain/rules/examRules';
import { getServiceTier } from '@/domain/rules/subjectRules';
import { InsufficientCreditsError, ValidationError } from '@/shared/errors';
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/shared/constants';

export interface UploadExamInput {
  userId: string;
  file: File;
  subject?: import('@/domain/value-objects').SubjectOrOther;
}

export interface UploadExamOutput {
  examId: string;
  remainingCredits: number;
}

export class UploadExamUseCase implements UseCase<UploadExamInput, UploadExamOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly creditRepo: ICreditRepository,
    private readonly storageGateway: IStorageGateway,
  ) {}

  async execute(input: UploadExamInput): Promise<UploadExamOutput> {
    const { userId, file, subject = 'math' } = input;

    // 1. Check credits
    const credit = await this.creditRepo.findByUserId(userId);
    if (!credit || !hasSufficientCredits(credit, 1)) {
      const available = credit ? getRemainingCredits(credit) : 0;
      throw new InsufficientCreditsError(1, available);
    }

    // 2. Validate file
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new ValidationError(
        `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
      );
    }

    // 2b. Validate magic bytes to prevent disguised files
    await validateMagicBytes(file);

    // 3. Upload file to storage
    const tempExamId = crypto.randomUUID();
    let imageUrl: string;
    try {
      imageUrl = await this.storageGateway.upload(userId, tempExamId, file);
    } catch (error) {
      throw error;
    }

    // 4. Create exam record (capture returned exam to get DB-generated id)
    let exam;
    try {
      exam = await this.examRepo.create({
        userId,
        subject,
        serviceTier: getServiceTier(subject),
        imageUrl,
        ocrResult: null,
        status: 'processing',
        expiresAt: getExpiryDate().toISOString(),
      });
    } catch (error) {
      // Rollback: delete uploaded file on exam creation failure
      try {
        await this.storageGateway.delete(imageUrl);
      } catch {
        // Ignore cleanup failure — preserve original error
      }
      throw error;
    }

    // 5. Deduct credit (last step — if this fails, exam exists but credit not lost)
    let updatedCredit;
    try {
      updatedCredit = await this.creditRepo.deduct(userId, 1);
    } catch (error) {
      // Credit deduction failed — exam record exists but no credit was lost
      throw error;
    }

    // 6. Return result (use DB-generated examId)
    const remainingCredits = getRemainingCredits(updatedCredit);
    return { examId: exam.id, remainingCredits };
  }
}

// Magic bytes signatures for allowed file types
const MAGIC_SIGNATURES: { type: string; bytes: number[] }[] = [
  { type: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { type: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
  { type: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

async function validateMagicBytes(file: File): Promise<void> {
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const matches = MAGIC_SIGNATURES.some(
    (sig) => sig.bytes.every((b, i) => header[i] === b),
  );
  if (!matches) {
    throw new ValidationError('파일 내용이 확장자와 일치하지 않습니다.');
  }
}
