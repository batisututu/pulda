import type { Question, ClassificationResult, Blueprint } from '@/domain/entities';
import type { Subject } from '@/domain/value-objects';

export interface IClassifierGateway {
  classify(question: Question, grade: string, subject?: Subject): Promise<ClassificationResult>;
  classifyBatch(questions: Question[], grade: string, subject?: Subject): Promise<ClassificationResult[]>;
  generateBlueprint(classifications: ClassificationResult[]): Promise<Omit<Blueprint, 'id' | 'examId' | 'createdAt'>>;
}
