import type { OcrResult } from '@/domain/entities';
import type { SubjectOrOther } from '@/domain/value-objects';

export interface IOcrGateway {
  processImage(imageBase64: string, subject?: SubjectOrOther): Promise<OcrResult>;
}
