import type { UseCase } from '@/shared/types';
import type { Blueprint, ErrorDiagnosis, Question, VariantQuestion } from '@/domain/entities';
import type {
  IExamRepository,
  IQuestionRepository,
  IDiagnosisRepository,
  IVariantRepository,
  IBlueprintRepository,
} from '@/domain/ports/repositories';
import { NotFoundError, ForbiddenError } from '@/shared/errors';

export interface GetDiagnosisInput {
  userId: string;
  examId: string;
}

export interface DiagnosisSummary {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number; // 0-1
}

export interface GetDiagnosisOutput {
  examId: string;
  blueprint: Blueprint | null;
  diagnoses: (ErrorDiagnosis & { question: Question; variants: VariantQuestion[] })[];
  summary: DiagnosisSummary;
}

/**
 * GetDiagnosisUseCase - Retrieves enriched diagnosis data for a given exam.
 *
 * Loads the blueprint, all diagnoses, and for each diagnosis enriches it
 * with the associated question and variant questions.
 */
export class GetDiagnosisUseCase implements UseCase<GetDiagnosisInput, GetDiagnosisOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly diagnosisRepo: IDiagnosisRepository,
    private readonly variantRepo: IVariantRepository,
    private readonly blueprintRepo: IBlueprintRepository,
  ) {}

  async execute(input: GetDiagnosisInput): Promise<GetDiagnosisOutput> {
    const { userId, examId } = input;

    // 1. Load exam and verify ownership
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new NotFoundError('Exam', examId);
    }

    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    // 2. Load blueprint and all questions in parallel
    const [blueprint, allQuestions, diagnoses] = await Promise.all([
      this.blueprintRepo.findByExamId(examId),
      this.questionRepo.findByExamId(examId),
      this.diagnosisRepo.findByExamId(examId),
    ]);

    // 3. 배치 조회로 N+1 문제 해결
    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

    const diagnosisIds = diagnoses.map((d) => d.id);
    const allVariants = await this.variantRepo.findByDiagnosisIds(diagnosisIds);
    const variantsByDiagnosisId = new Map<string, VariantQuestion[]>();
    for (const v of allVariants) {
      if (!v.diagnosisId) continue;
      const list = variantsByDiagnosisId.get(v.diagnosisId) ?? [];
      list.push(v);
      variantsByDiagnosisId.set(v.diagnosisId, list);
    }

    const enrichedDiagnoses = diagnoses.map((diagnosis) => {
      const question = questionMap.get(diagnosis.questionId);
      if (!question) {
        throw new NotFoundError('Question', diagnosis.questionId);
      }
      return {
        ...diagnosis,
        question,
        variants: variantsByDiagnosisId.get(diagnosis.id) ?? [],
      };
    });

    // 4. Compute summary statistics
    const correctCount = allQuestions.filter((q) => q.isCorrect === true).length;
    const wrongCount = allQuestions.filter((q) => q.isCorrect === false).length;
    const unansweredCount = allQuestions.length - correctCount - wrongCount;

    return {
      examId,
      blueprint,
      diagnoses: enrichedDiagnoses,
      summary: {
        totalQuestions: allQuestions.length,
        correctCount,
        wrongCount,
        unansweredCount,
        accuracy: allQuestions.length > 0 ? correctCount / allQuestions.length : 0,
      },
    };
  }
}
