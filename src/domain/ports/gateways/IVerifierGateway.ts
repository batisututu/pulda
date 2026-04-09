import type { Question } from '@/domain/entities';
import type { Subject } from '@/domain/value-objects';

export interface IVerifierGateway {
  verify(question: Question, subject?: Subject): Promise<{ answer: string; briefSolution: string }>;
}
