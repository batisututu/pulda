import type { UseCase } from '@/shared/types';
import type { IFeedbackRepository } from '@/domain/ports/repositories';
import { ValidationError } from '@/shared/errors';

export interface SubmitFeedbackInput {
  userId: string;
  content: string;
  page: string;
}

export interface SubmitFeedbackOutput {
  feedbackId: string;
}

export class SubmitFeedbackUseCase implements UseCase<SubmitFeedbackInput, SubmitFeedbackOutput> {
  constructor(
    private readonly feedbackRepo: IFeedbackRepository,
  ) {}

  async execute(input: SubmitFeedbackInput): Promise<SubmitFeedbackOutput> {
    const { userId, content, page } = input;

    // 1. Validate content is not empty
    if (!content || content.trim().length === 0) {
      throw new ValidationError('Feedback content cannot be empty');
    }

    // 2. Validate page is an allowed target type
    const allowedTargetTypes = ['explanation', 'variant', 'blueprint'] as const;
    if (!allowedTargetTypes.includes(page as typeof allowedTargetTypes[number])) {
      throw new ValidationError('Invalid feedback target type');
    }

    // 3. Create feedback via upsert (maps to Feedback entity structure)
    const feedbackId = crypto.randomUUID();
    const feedback = await this.feedbackRepo.upsert({
      userId,
      targetType: page as 'explanation' | 'variant' | 'blueprint',
      targetId: feedbackId,
      rating: 1,
    });

    return { feedbackId: feedback.id };
  }
}
