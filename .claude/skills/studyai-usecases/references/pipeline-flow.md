# AI Pipeline Orchestration Flow

Detailed specification of how the AI pipeline stages are orchestrated within the use case layer, including caching, batching, model selection, error handling, and cost optimization.

## 1. Pipeline Architecture

```
┌──────────┐    ┌──────────────┐    ┌────────────┐    ┌─────────────────────┐    ┌──────────────────┐    ┌─────────────┐
│  Upload   │───>│  L1: OCR     │───>│  User      │───>│  L2: Classify       │───>│  L3: Explain     │───>│ L4: Variant │
│  Image    │    │  + Split     │    │  Verify    │    │  + Blueprint        │    │  + Verify        │    │ Generation  │
└──────────┘    └──────────────┘    └────────────┘    └─────────────────────┘    └──────────────────┘    └─────────────┘
 UploadExam      RunOcrUseCase      VerifyQuestions           AnalyzeExamUseCase (L2 + L3 + L4)
  UseCase                             UseCase         ◄────────────────────────────────────────────►
```

| Stage | Layer | Model | Input | Output | Cost/item |
|-------|-------|-------|-------|--------|-----------|
| 1. OCR + Question Split | L1 | GPT-4o-mini Vision | Exam image (base64) | Structured question JSON | ~$0.008/page |
| 2. User Verification | -- | Human | Question cards UI | Confirmed/corrected questions | $0 |
| 3. Classification + Blueprint | L2 | GPT-4o-mini (JSON mode) | Question text + grade | Unit/type/difficulty + blueprint | ~$0.003/question |
| 4. Explanation + Diagnosis | L3a | Claude Sonnet | Wrong answer + question + classification | ErrorDiagnosis + step-by-step | ~$0.030/question |
| 5. Verification | L3b | GPT-4o-mini | Question only | Independent answer for cross-check | ~$0.006/question |
| 6. Variant Generation | L4 | Claude 4.5 Sonnet | ErrorDiagnosis + original question | 3-5 corrective variant questions | ~$0.030/question |

## 2. AnalyzeExamUseCase Detailed Flow

The `AnalyzeExamUseCase` is the central orchestrator for stages 3-6 (L2 + L3 + L4). Below is the complete step-by-step flow with caching integration.

```
AnalyzeExamUseCase.execute(input)
│
├── 1. Load & Validate
│   ├── examRepo.findById(examId)
│   ├── questionRepo.findByExamId(examId)
│   ├── Verify ownership: exam.userId === input.userId
│   ├── Verify status: canTransitionStatus('verified', 'analyzed')
│   └── Check expiry: !isExpired(exam)
│
├── 2. Credit Pre-check
│   ├── wrongQuestions = questions.filter(q => q.isCorrect === false)
│   ├── credit = creditRepo.findByUserId(userId)
│   └── hasSufficientCredits(credit, wrongQuestions.length) → 402 if false
│
├── 3. Cache Lookup (per question)
│   ├── For each question:
│   │   ├── hash = SHA-256(normalize(question.content))
│   │   ├── cached = cacheRepo.findByHash(hash)
│   │   ├── If cached.classification exists → use it, skip L2 for this question
│   │   ├── If cached.explanation exists → use it, skip L3 for this question
│   │   └── cacheRepo.incrementHitCount(cached.id) on hit
│   └── Track: cacheHits count, uncachedQuestions list
│
├── 4. L2: Classification (batch processing)
│   ├── Group uncached questions into batches of 5
│   ├── For each batch:
│   │   ├── classifierGateway.classifyBatch(batch, user.grade)
│   │   └── Save to cache: cacheRepo.upsert(hash, { classification: result })
│   └── Merge cached + fresh classifications
│
├── 5. L2: Blueprint Generation
│   ├── classifierGateway.generateBlueprint(allClassifications)
│   └── blueprintRepo.create({ examId, ...blueprint })
│
├── 6. L3: Explanation + Verification (per wrong question)
│   ├── For each wrongQuestion (parallel where possible):
│   │   ├── [a] If not cached:
│   │   │   ├── explanationGateway.diagnose(question, studentAnswer, classification)
│   │   │   └── Save to cache: cacheRepo.upsert(hash, { explanation: result })
│   │   ├── [b] verifierGateway.verify(question) → { answer, briefSolution }
│   │   ├── [c] confidence = determineConfidence(primaryAnswer, verifierAnswer, baseConfidence)
│   │   │   └── Match → high confidence; Differ → cap at 0.5
│   │   └── [d] diagnosisRepo.create({ questionId, errorType, confidence, reasoning, ... })
│   └── Collect all ErrorDiagnosis records
│
├── 7. L4: Variant Generation (per diagnosis)
│   ├── For each diagnosis:
│   │   ├── variantGeneratorGateway.generate(diagnosis, originalQuestion, count=3)
│   │   └── variantRepo.createMany(variants)
│   └── Collect all VariantQuestion records
│
├── 8. Credit Deduction (atomic)
│   └── creditRepo.deduct(userId, wrongQuestions.length)
│       └── Atomic SQL: UPDATE credits SET used = used + N WHERE (total - used) >= N
│
├── 9. Status Update
│   └── examRepo.update(examId, { status: 'analyzed' })
│
└── 10. Return Result
    └── { examId, blueprint, diagnoses, variants, creditsUsed, cacheHits, status: 'analyzed' }
```

## 3. Caching Strategy

### Content Hashing

Questions are cached by a SHA-256 hash of their normalized content. This allows reuse across different exams when the same question appears (common in practice -- similar school exams).

```typescript
function computeContentHash(content: string): string {
  const normalized = content
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/\\,|\\;|\\!/g, '')    // remove LaTeX spacing commands
    .trim()
    .toLowerCase();
  return sha256(normalized);
}
```

### Cache Lookup Flow

```
Question Content
    │
    ▼
normalize(content)
    │
    ▼
SHA-256 hash
    │
    ▼
cacheRepo.findByHash(hash)
    │
    ├── HIT (classification exists) ──► Skip L2 for this question
    ├── HIT (explanation exists) ──► Skip L3 for this question
    └── MISS ──► Proceed to L2/L3, save result to cache
```

### Cache Savings

- Cache stores: `classification` (L2 result) and `explanation` (L3 result)
- L4 variants are NOT cached (intentionally varied each time for practice diversity)
- `hitCount` tracks popularity for analytics
- Expected cache hit rate: 20-30% (same questions across students/exams)
- Cost reduction: 20-30% of AI API costs saved through caching

### Cache Invalidation

- No TTL-based expiration (question content is immutable)
- Cache is append-only, grows over time
- Periodic cleanup of entries with hitCount = 0 after 90 days (optional maintenance job)

## 4. Batching Strategy

### L2 Classification Batching

GPT-4o-mini supports batch classification of multiple questions in a single API call, reducing overhead.

```
20 questions ──► 4 batches of 5 ──► 4 API calls (instead of 20)
```

- Batch size: 5 questions per call
- Reason: Keeps token count manageable for JSON mode reliability
- All questions in a batch share the same grade context
- If a batch partially fails, successfully classified questions are saved; failed ones are retried individually

### L1 OCR: No Batching

- One page per call (Vision API limitation)
- Multi-page PDFs: sequential calls, merge by question number

### L4 Variants: On-Demand

- Variants are generated per-diagnosis, not pre-batched
- Default 3 variants per diagnosis during initial analysis
- User can request additional variants via `GenerateVariantsUseCase` (1 credit per call)

### L3 Explanation: Per-Question with Parallel Verification

- Each wrong question gets its own L3 call (question-specific context needed)
- Explanation (Claude) and verification (GPT-4o-mini) run in parallel for the same question
- Multiple wrong questions can be processed concurrently (Promise.allSettled)

```
Wrong Q1 ──┬──► Claude: diagnose ──┐
           └──► GPT: verify    ────┤──► determineConfidence ──► save
                                   │
Wrong Q2 ──┬──► Claude: diagnose ──┐
           └──► GPT: verify    ────┤──► determineConfidence ──► save
                                   │
Wrong Q3 ──┬──► Claude: diagnose ──┐
           └──► GPT: verify    ────┘──► determineConfidence ──► save
```

## 5. Model Selection Rules

| Task | Model | Reason | Cost Tier |
|------|-------|--------|-----------|
| L1: OCR | GPT-4o-mini Vision | Cheapest vision model, sufficient for Korean text OCR | Low |
| L2: Classification | GPT-4o-mini (JSON mode) | Structured output, fast, cheap, accurate for categorization | Low |
| L3a: Explanation | Claude Sonnet | Superior reasoning for math step-by-step, Korean quality | Medium |
| L3b: Verification | GPT-4o-mini | Independent cross-check, cheap enough for every question | Low |
| L4: Variant Gen | Claude 4.5 Sonnet | Highest reasoning for creative variant generation | Medium |

### Selection Principles

1. **Never use Claude for L1/L2** -- GPT-4o-mini is ~10x cheaper and sufficient for OCR/classification
2. **Claude Sonnet for explanation quality** -- Better Korean math reasoning, clearer step-by-step
3. **Claude 4.5 Sonnet for variant creativity** -- Highest reasoning for generating novel, pedagogically sound variants
4. **GPT-4o-mini for all verification** -- Independent model cross-check; using a different model family adds verification value
5. **Cost-first for simple tasks, quality-first for learning-critical tasks**

## 6. Error Handling Between Stages

### Independence Principle

Each pipeline stage is independently retriable. Failure in one stage does not block or invalidate results from other stages.

```
L2 fails for Q5 ──► Q5 gets generic classification, all other questions proceed normally
L3 fails for Q8 ──► Q8 shows "analysis unavailable" card, all other diagnoses complete
L4 fails for D3 ──► D3 shows explanation without variants, retry button available
```

### Stage-Level Error Recovery

| Stage | Failure Behavior | User Experience | Recovery |
|-------|-----------------|-----------------|----------|
| L1 (OCR) | Entire pipeline blocked | "OCR failed, please re-photograph" | Retry upload |
| L2 (Classify) | Per-question fallback | Generic classification, flagged for review | Retry analysis |
| L3 (Explain) | Per-question skip | "Analysis unavailable" card with retry button | Retry single question |
| L4 (Variants) | Per-diagnosis skip | Show explanation without variants, retry button | Retry variant generation |

### Partial Results Persistence

- After each stage completes (even partially), results are saved to the database
- On retry, the use case detects existing results and skips completed work
- Cached results are reused on retry (no duplicate API cost)
- The exam status remains at the last successful stage (e.g., stays 'verified' if L2 fails entirely)

### Retry Strategy

- Each AI gateway call uses exponential backoff: 1s, 2s, 4s (max 3 retries)
- Rate limit errors (429): respect Retry-After header
- Timeout: 30s for L1/L2, 60s for L3/L4 (longer reasoning)
- After max retries: save error state, return partial results, allow manual retry

### Error Propagation

```typescript
// In AnalyzeExamUseCase:
const results = await Promise.allSettled(
  wrongQuestions.map(q => processQuestion(q))
);

const successes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
const failures = results.filter(r => r.status === 'rejected').map(r => r.reason);

// Save successes, report failures, do not throw if partial results exist
if (successes.length === 0 && failures.length > 0) {
  throw new PipelineStageError('All questions failed analysis', failures);
}
// Partial success: save what we have, include failure info in response
```

## 7. Cost Estimate

### Per-Exam Cost Breakdown (20 questions, ~7 wrong)

| Stage | Model | Calls | Cost/Call | Subtotal |
|-------|-------|-------|-----------|----------|
| L1: OCR | GPT-4o-mini Vision | 1 page | $0.008 | $0.008 |
| L2: Classify | GPT-4o-mini | 4 batches (20 questions) | $0.003/q | $0.060 |
| L2: Blueprint | GPT-4o-mini | 1 call | $0.005 | $0.005 |
| L3a: Explain | Claude Sonnet | 7 wrong questions | $0.030/q | $0.210 |
| L3b: Verify | GPT-4o-mini | 7 wrong questions | $0.006/q | $0.042 |
| L4: Variants | Claude 4.5 Sonnet | 7 diagnoses x 3 variants | $0.030/q | $0.210 |
| **Subtotal (no cache)** | | | | **$0.535** |
| Cache savings (est. 25%) | | | | -$0.134 |
| **Total per exam** | | | | **~$0.40** |

### Monthly Cost Projections

| Scenario | Students | Exams/Student/Month | Monthly Cost |
|----------|----------|-------------------|-------------|
| Early (100 users) | 100 | 3 | ~$120 |
| Growth (1,000 users) | 1,000 | 4 | ~$1,600 |
| Scale (10,000 users) | 10,000 | 5 | ~$20,000 |

### Cost Alert

- Monitor per-exam cost; alert if exceeds $1.50 (estimated threshold)
- Log every API call: model, tokens (input/output), cost, latency, stage, examId
- Track per-user monthly cost for plan enforcement

## 8. Sprint Reference

| Sprint | Weeks | Use Case Work | Pipeline Stage |
|--------|-------|---------------|---------------|
| 1-2 | 1-2 | UploadExamUseCase, RunOcrUseCase, VerifyQuestionsUseCase | L1: OCR + question verification |
| 3-4 | 3-4 | AnalyzeExamUseCase (L2+L3+L4), GetDiagnosisUseCase, GenerateVariantsUseCase | L2: Classification + L3: Explanation + L4: Variants |
| 5-6 | 5-6 | CreateMiniTestUseCase, SubmitAnswersUseCase, GetResultsUseCase | Scoring engine, mini-test flow |
| 5-6 | 5-6 | FollowUserUseCase, RespondToFollowUseCase, ShareItemUseCase, GetFeedUseCase, SearchUsersUseCase | Social system |
| 5-6 | 5-6 | GenerateLinkCodeUseCase, LinkParentUseCase, UnlinkParentUseCase, GetDashboardUseCase | Parent-child linking |
| 7 | 7 | CheckoutUseCase, ProcessWebhookUseCase, CheckCreditsUseCase | Payment integration |
| 7 | 7 | GetNotificationsUseCase, MarkNotificationReadUseCase, SubmitFeedbackUseCase | Notifications + feedback |
| 8 | 8 | Caching layer integration, retry optimization, cost monitoring, E2E testing | Pipeline optimization |
