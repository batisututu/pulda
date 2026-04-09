import crypto from 'crypto';
import type { UseCase } from '@/shared/types';
import type { Blueprint, ErrorDiagnosis, VariantQuestion, Question, ClassificationResult, ExplanationResult } from '@/domain/entities';
import type { ExamStatus } from '@/domain/value-objects';
import type {
  IExamRepository,
  IQuestionRepository,
  IBlueprintRepository,
  IDiagnosisRepository,
  IVariantRepository,
  ICreditRepository,
  ICacheRepository,
  IUserRepository,
} from '@/domain/ports/repositories';
import type {
  IClassifierGateway,
  IExplanationGateway,
  IVerifierGateway,
  IVariantGeneratorGateway,
} from '@/domain/ports/gateways';
import { canTransitionStatus, isExpired } from '@/domain/rules/examRules';
import { hasSufficientCredits, calculateCost } from '@/domain/rules/creditRules';
import { determineConfidence } from '@/domain/rules/errorTypeDetection';
import { isValidVisualExplanation } from '@/domain/rules/visualExplanationRules';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  InsufficientCreditsError,
  ExpiredError,
  PipelineStageError,
} from '@/shared/errors';
import { CLASSIFICATION_BATCH_SIZE, DEFAULT_VARIANT_COUNT } from '@/shared/constants';

export interface AnalyzeExamInput {
  userId: string;
  examId: string;
}

export interface AnalyzeExamSummary {
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number; // 0-1
}

export interface AnalyzeExamOutput {
  examId: string;
  blueprint: Blueprint;
  diagnoses: (ErrorDiagnosis & { question: Question; variants: VariantQuestion[] })[];
  variants: VariantQuestion[];
  creditsUsed: number;
  cacheHits: number;
  status: ExamStatus;
  summary: AnalyzeExamSummary;
}

/**
 * Computes a SHA-256 hash of normalized question content for caching.
 * Normalization: collapse whitespace, remove LaTeX spacing commands, lowercase, trim.
 */
function computeContentHash(content: string): string {
  const normalized = content
    .replace(/\s+/g, ' ')
    .replace(/\\,|\\;|\\!/g, '')
    .trim()
    .toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * AnalyzeExamUseCase - Central pipeline orchestrator for L2 + L3 + L4.
 *
 * Flow:
 * 1. Load & validate (ownership, status, expiry)
 * 2. Credit pre-check
 * 3. Cache lookup per question
 * 4. L2: Classification (batch) + Blueprint generation
 * 5. L3: Explanation + Verification (parallel per wrong question)
 * 6. L4: Variant generation (per diagnosis)
 * 7. Credit deduction
 * 8. Status update to 'analyzed'
 */
export class AnalyzeExamUseCase implements UseCase<AnalyzeExamInput, AnalyzeExamOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly questionRepo: IQuestionRepository,
    private readonly blueprintRepo: IBlueprintRepository,
    private readonly diagnosisRepo: IDiagnosisRepository,
    private readonly variantRepo: IVariantRepository,
    private readonly creditRepo: ICreditRepository,
    private readonly cacheRepo: ICacheRepository,
    private readonly userRepo: IUserRepository,
    private readonly classifierGateway: IClassifierGateway,
    private readonly explanationGateway: IExplanationGateway,
    private readonly verifierGateway: IVerifierGateway,
    private readonly variantGeneratorGateway: IVariantGeneratorGateway,
  ) {}

  async execute(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
    const { userId, examId } = input;

    // --- 1. Load & Validate ---
    const exam = await this.examRepo.findById(examId);
    if (!exam) {
      throw new NotFoundError('Exam', examId);
    }

    if (exam.userId !== userId) {
      throw new ForbiddenError('Access denied: not the exam owner');
    }

    // Retry: reset 'error' back to 'verified' so analysis can proceed
    if (exam.status === 'error') {
      if (!canTransitionStatus('error', 'verified')) {
        throw new ValidationError('Cannot retry analysis from current state');
      }
      await this.examRepo.update(examId, { status: 'verified' });
      exam.status = 'verified';
    }

    if (!canTransitionStatus(exam.status, 'analyzed')) {
      throw new ValidationError(
        `Cannot transition exam status from '${exam.status}' to 'analyzed'`,
      );
    }

    if (isExpired(exam)) {
      throw new ExpiredError('Exam');
    }

    const allQuestions = await this.questionRepo.findByExamId(examId);

    // --- 2. Filter wrong questions ---
    // 학생 답안 데이터 존재 여부 확인 — OCR 직후는 모든 isCorrect가 null
    const hasAnyGrading = allQuestions.some(
      (q) => q.isCorrect === true || q.isCorrect === false,
    );
    // 채점 데이터 없으면(모두 null) L3+L4 건너뜀 — L2 분류+블루프린트만 생성
    // 채점 데이터 있으면 기존 로직 유지 (null=미답도 오답으로 처리)
    const wrongQuestions = hasAnyGrading
      ? allQuestions.filter((q) => q.isCorrect !== true)
      : allQuestions.filter((q) => q.isCorrect === false);
    const wrongCount = wrongQuestions.length;

    // --- 2b. Credit pre-check ---
    const credit = await this.creditRepo.findByUserId(userId);
    if (!credit) {
      throw new NotFoundError('Credit', userId);
    }
    if (!hasSufficientCredits(credit, wrongCount)) {
      throw new InsufficientCreditsError(calculateCost(wrongCount), credit.total - credit.used);
    }

    // --- 3. Cache lookup ---
    let cacheHits = 0;
    const questionCacheMap = new Map<string, {
      hash: string;
      classification: ClassificationResult | null;
      explanation: ExplanationResult | null;
    }>();

    for (const q of allQuestions) {
      const hash = computeContentHash(q.content);
      const cached = await this.cacheRepo.findByHash(hash);

      if (cached) {
        const hasClassification = cached.classification !== null;
        const hasExplanation = cached.explanation !== null;
        if (hasClassification || hasExplanation) {
          cacheHits++;
          await this.cacheRepo.incrementHitCount(cached.id);
        }
        questionCacheMap.set(q.id, {
          hash,
          classification: cached.classification,
          explanation: cached.explanation,
        });
      } else {
        questionCacheMap.set(q.id, {
          hash,
          classification: null,
          explanation: null,
        });
      }
    }

    // --- 5. L2: Classification (batch processing) ---
    // Get user grade for classification context
    const user = await this.userRepo.findById(userId);
    const grade = user?.grade ?? 'high1';

    // Separate cached vs uncached questions for classification
    const uncachedForClassification = allQuestions.filter((q) => {
      const cached = questionCacheMap.get(q.id);
      return !cached?.classification;
    });

    const allClassifications: ClassificationResult[] = [];

    // Add cached classifications
    for (const q of allQuestions) {
      const cached = questionCacheMap.get(q.id);
      if (cached?.classification) {
        allClassifications.push({ ...cached.classification, questionId: q.id });
      }
    }

    // Classify uncached questions in batches
    for (let i = 0; i < uncachedForClassification.length; i += CLASSIFICATION_BATCH_SIZE) {
      const batch = uncachedForClassification.slice(i, i + CLASSIFICATION_BATCH_SIZE);
      const batchResults = await this.classifierGateway.classifyBatch(batch, grade);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        allClassifications.push(result);

        // Save to cache
        const question = batch[j];
        const cacheEntry = questionCacheMap.get(question.id);
        if (cacheEntry) {
          await this.cacheRepo.upsert(cacheEntry.hash, { classification: result });
        }
      }
    }

    // --- 6. L2: Blueprint generation (upsert for idempotency on re-runs) ---
    const blueprintData = await this.classifierGateway.generateBlueprint(allClassifications);
    const existingBlueprint = await this.blueprintRepo.findByExamId(examId);
    const blueprint = existingBlueprint ?? await this.blueprintRepo.create({
      examId,
      ...blueprintData,
    });

    // --- 7. L3: Explanation + Verification (per wrong question, parallel) ---
    // Build a map of questionId -> classification for lookup
    const classificationMap = new Map<string, ClassificationResult>();
    for (const c of allClassifications) {
      classificationMap.set(c.questionId, c);
    }

    const diagnosisResults = await Promise.allSettled(
      wrongQuestions.map(async (question) => {
        return this.processWrongQuestion(question, classificationMap, questionCacheMap, grade);
      }),
    );

    const diagnoses: ErrorDiagnosis[] = [];
    const diagnosisFailures: unknown[] = [];

    for (const result of diagnosisResults) {
      if (result.status === 'fulfilled') {
        diagnoses.push(result.value);
      } else {
        diagnosisFailures.push(result.reason);
      }
    }

    // If all questions failed, throw PipelineStageError
    if (diagnoses.length === 0 && diagnosisFailures.length > 0) {
      try {
        await this.examRepo.update(examId, { status: 'error' });
      } catch {
        // Ignore status update failure
      }
      throw new PipelineStageError('All questions failed analysis', diagnosisFailures);
    }

    // --- 8. L4: Variant generation (per diagnosis) ---
    const allVariants: VariantQuestion[] = [];

    const variantResults = await Promise.allSettled(
      diagnoses.map(async (diagnosis) => {
        const originalQuestion = wrongQuestions.find((q) => q.id === diagnosis.questionId);
        if (!originalQuestion) return [];

        const result = await this.variantGeneratorGateway.generate(
          diagnosis,
          originalQuestion,
          DEFAULT_VARIANT_COUNT,
        );

        const variants = await this.variantRepo.createMany(
          result.variants.map((v) => ({
            diagnosisId: diagnosis.id,
            userId: null,
            topic: null,
            grade: null,
            content: v.content,
            questionType: v.type,
            options: v.options,
            answer: v.answer,
            explanation: v.explanation,
            difficulty: v.difficulty,
            targetErrorType: v.targetErrorType,
            bloomLevel: v.bloomLevel,
            trapPoint: v.trapPoint,
            targetTimeSeconds: v.targetTimeSeconds,
            verification: v.verification ?? null,
            visualExplanation: v.visualExplanation ?? null,
          })),
        );

        return variants;
      }),
    );

    for (const result of variantResults) {
      if (result.status === 'fulfilled') {
        allVariants.push(...result.value);
      }
      // Variant failures are non-blocking -- partial results are acceptable
    }

    // --- 9. Credit deduction (charge only for non-cached wrong questions) ---
    const creditsUsed = Math.max(0, wrongCount - cacheHits);
    if (creditsUsed > 0) {
      await this.creditRepo.deduct(userId, creditsUsed);
    }

    // --- 10. Status update (guard already validated at step 1) ---
    await this.examRepo.update(examId, { status: 'analyzed' });

    // --- 11. Compute summary statistics ---
    const correctCount = allQuestions.filter((q) => q.isCorrect === true).length;
    const explicitWrongCount = allQuestions.filter((q) => q.isCorrect === false).length;
    const unansweredCount = allQuestions.length - correctCount - explicitWrongCount;

    // Enrich diagnoses with question and variants for presentation
    const enrichedDiagnoses = diagnoses.map((d) => ({
      ...d,
      question: wrongQuestions.find((q) => q.id === d.questionId)!,
      variants: allVariants.filter((v) => v.diagnosisId === d.id),
    }));

    return {
      examId,
      blueprint,
      diagnoses: enrichedDiagnoses,
      variants: allVariants,
      creditsUsed,
      cacheHits,
      status: 'analyzed',
      summary: {
        totalQuestions: allQuestions.length,
        correctCount,
        wrongCount: explicitWrongCount,
        unansweredCount,
        accuracy: allQuestions.length > 0 ? correctCount / allQuestions.length : 0,
      },
    };
  }

  /**
   * Process a single wrong question through L3 (explanation + verification).
   * Runs explanation and verification in parallel, then determines confidence.
   */
  private async processWrongQuestion(
    question: Question,
    classificationMap: Map<string, ClassificationResult>,
    questionCacheMap: Map<string, {
      hash: string;
      classification: ClassificationResult | null;
      explanation: ExplanationResult | null;
    }>,
    grade: string,
  ): Promise<ErrorDiagnosis> {
    const classification = classificationMap.get(question.id);
    if (!classification) {
      throw new Error(`No classification found for question ${question.id}`);
    }

    const cacheEntry = questionCacheMap.get(question.id);

    // Run explanation (or use cache) and verification in parallel
    const [explanationResult, verifierResult] = await Promise.all([
      // L3a: Explanation (cached or fresh)
      cacheEntry?.explanation
        ? Promise.resolve(cacheEntry.explanation)
        : this.explanationGateway
            .diagnose(question, question.studentAnswer ?? '', classification, grade)
            .then(async (result) => {
              // Save to cache
              if (cacheEntry) {
                await this.cacheRepo.upsert(cacheEntry.hash, { explanation: result });
              }
              return result;
            }),
      // L3b: Verification (always fresh -- different model for cross-check)
      this.verifierGateway.verify(question),
    ]);

    // Determine confidence using both results
    const confidence = determineConfidence(
      explanationResult.correctAnswer,
      verifierResult.answer,
      explanationResult.confidence,
    );

    // Backfill correct answer from L3a if OCR didn't extract it
    if (!question.answer && explanationResult.correctAnswer) {
      await this.questionRepo.updateMany([{
        id: question.id,
        data: { answer: explanationResult.correctAnswer },
      }]);
      question.answer = explanationResult.correctAnswer;
    }

    // Validate visual explanation (primary output — retry once if invalid)
    let visualExplanation = explanationResult.visualExplanation;
    if (visualExplanation && !isValidVisualExplanation(visualExplanation)) {
      // 1st attempt invalid — retry with simplified prompt
      try {
        const retryResult = await this.explanationGateway
          .diagnose(question, question.studentAnswer ?? '', classification, grade);
        if (retryResult.visualExplanation && isValidVisualExplanation(retryResult.visualExplanation)) {
          visualExplanation = retryResult.visualExplanation;
        } else {
          visualExplanation = null; // fallback to text
        }
      } catch {
        visualExplanation = null; // fallback to text on error
      }
    }

    // Create and persist the diagnosis
    const diagnosis = await this.diagnosisRepo.create({
      questionId: question.id,
      errorType: explanationResult.errorType,
      confidence,
      reasoning: explanationResult.errorReasoning,
      correction: explanationResult.correctionGuidance,
      stepByStep: explanationResult.stepByStep,
      verificationResult: {
        verified: true,
        verifierAnswer: verifierResult.answer,
        match: explanationResult.correctAnswer.replace(/\s+/g, '').toLowerCase() ===
               verifierResult.answer.replace(/\s+/g, '').toLowerCase(),
      },
      visualExplanation,
    });

    return diagnosis;
  }
}
