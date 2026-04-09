---
name: studyai-usecases
description: |
  Guide the application use case layer for StudyAI (시험의 신), covering exam pipeline, mini-test, social, parent, and payment flows.
  Use this skill when:
  - Implementing or modifying use case classes that orchestrate domain logic (exam upload/OCR/analyze, mini-test, social, parent, payment)
  - Defining use case input/output DTOs and execute flows
  - Coordinating multi-stage AI pipeline steps (L1 OCR, L2 classify, L3 explain+verify, L4 variants) within AnalyzeExamUseCase
  - Implementing credit deduction, caching, or batching logic at the use case level
  - Wiring port interfaces (repositories + gateways) into use case constructors
  - Handling errors, retries, partial results, and HTTP status mapping for each use case
  - Writing transaction boundaries for atomic credit operations
  - Implementing parent-child linking, follow/share social flows, or notification use cases
  Do NOT use for: Domain entities/rules/ports (use studyai-domain). Database schema/SQL/RLS (use studyai-infrastructure). AI prompts/model config (use studyai-infrastructure). React components/UI (use studyai-presentation). Design/pen file work (use studyai-design).
---

# StudyAI Use Case Layer Guide

The application layer that orchestrates domain objects, ports, and business rules into complete user-facing workflows. Sits between presentation (API routes) and domain/infrastructure in the Clean Architecture ring.

## 1. Dependency Rule

`src/usecases/` may import from `src/domain/` and `src/shared/` only.

**FORBIDDEN**: usecases must NEVER import from `src/infrastructure/` or `src/presentation/`. No Supabase client, no OpenAI SDK, no Expo, no React Native, no React. Use cases receive port interfaces (repositories, gateways) via constructor injection and call them through abstract contracts defined in `src/domain/ports/`.

> **Mobile App Note**: In the Expo/React Native app, screens and Zustand stores invoke use cases directly via the DI container (`container.createXxxUseCase().execute()`), not through API routes. For server-side operations requiring secret keys (AI pipeline, payment webhooks), Supabase Edge Functions act as thin controllers.

```
presentation/ --> usecases/ --> domain/
                     |              |
                     v              v
               (ports only)    shared/
                     |
                     v
              infrastructure/  (injected at composition root, never imported)
```

## 2. Project Structure

```
src/usecases/
├── exam/
│   ├── UploadExamUseCase.ts
│   ├── RunOcrUseCase.ts
│   ├── VerifyQuestionsUseCase.ts
│   └── AnalyzeExamUseCase.ts
├── diagnosis/
│   ├── GetDiagnosisUseCase.ts
│   └── GenerateVariantsUseCase.ts
├── minitest/
│   ├── CreateMiniTestUseCase.ts
│   ├── SubmitAnswersUseCase.ts
│   └── GetResultsUseCase.ts
├── social/
│   ├── FollowUserUseCase.ts
│   ├── RespondToFollowUseCase.ts
│   ├── ShareItemUseCase.ts
│   ├── GetFeedUseCase.ts
│   └── SearchUsersUseCase.ts
├── parent/
│   ├── GenerateLinkCodeUseCase.ts
│   ├── LinkParentUseCase.ts
│   ├── UnlinkParentUseCase.ts
│   └── GetDashboardUseCase.ts
├── payment/
│   ├── CheckoutUseCase.ts
│   ├── ProcessWebhookUseCase.ts
│   └── CheckCreditsUseCase.ts
├── common/
│   ├── GetNotificationsUseCase.ts
│   ├── MarkNotificationReadUseCase.ts
│   └── SubmitFeedbackUseCase.ts
└── index.ts
```

## 3. UseCase Pattern

Every use case implements the generic `UseCase` interface:

```typescript
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
```

### Constructor Injection

Use cases receive all dependencies through their constructor. Dependencies are port interfaces from `src/domain/ports/`.

```typescript
export class UploadExamUseCase implements UseCase<UploadExamInput, UploadExamOutput> {
  constructor(
    private readonly examRepo: IExamRepository,
    private readonly creditRepo: ICreditRepository,
    private readonly storageGateway: IStorageGateway,
  ) {}

  async execute(input: UploadExamInput): Promise<UploadExamOutput> {
    // 1. Validate
    // 2. Check credits
    // 3. Upload file
    // 4. Create exam record
    // 5. Return result
  }
}
```

### DTO Convention

- Input DTOs: named `{UseCaseName}Input`, contain userId + request data
- Output DTOs: named `{UseCaseName}Output`, contain result data only (no HTTP concepts)
- All DTOs are plain TypeScript interfaces (no class, no decorator)

## 4. Exam Pipeline Use Cases

The exam pipeline spans four use cases, each corresponding to a user action or API trigger:

| Use Case | Trigger | Pipeline Stage | Status Transition |
|----------|---------|---------------|-------------------|
| UploadExamUseCase | User uploads image | Pre-pipeline | (creates) -> `processing` |
| RunOcrUseCase | Auto or manual trigger | L1: OCR | `processing` -> `ocr_done` |
| VerifyQuestionsUseCase | User confirms questions | User verify | `ocr_done` -> `verified` |
| AnalyzeExamUseCase | User triggers analysis | L2 + L3 + L4 | `verified` -> `analyzed` -> `completed` |

### AnalyzeExamUseCase (L2 + L3 + L4 Orchestration)

The most complex use case. Coordinates three AI layers within a single execute call:

```typescript
async execute(input: AnalyzeExamInput): Promise<AnalyzeExamOutput> {
  // 1. Load exam + verified questions
  // 2. Check credits (hasSufficientCredits for wrongCount)
  // 3. For each question: check cache by contentHash
  //    - Cache hit: use cached classification + explanation, skip API call
  //    - Cache miss: proceed to L2/L3, save result to cache
  // 4. L2: Classify questions (batch 5/call via IClassifierGateway)
  // 5. L2: Generate blueprint (IClassifierGateway.generateBlueprint)
  // 6. L3: For each wrong answer:
  //    a. Diagnose via IExplanationGateway
  //    b. Verify via IVerifierGateway (parallel)
  //    c. Compute confidence (determineConfidence rule)
  //    d. Save ErrorDiagnosis
  // 7. L4: For each diagnosis, generate variants via IVariantGeneratorGateway
  // 8. Deduct credits (wrongCount)
  // 9. Update exam status -> 'analyzed'
  // 10. Return blueprint + diagnoses + variants
}
```

Each AI layer stage is independently retriable. If L3 fails for one question, other questions still get processed. Partial results are saved and can be resumed.

## 5. Mini-test Use Cases

| Use Case | Description |
|----------|-------------|
| CreateMiniTestUseCase | Select variant question IDs, create MiniTest record |
| SubmitAnswersUseCase | Score answers using scoringRules, store MiniTestAnswers, notify parent if linked |
| GetResultsUseCase | Return test + answers + original-vs-variant comparison |

### Scoring Flow (SubmitAnswersUseCase)

```typescript
// 1. Load MiniTest + VariantQuestions
// 2. For each answer:
//    - MC: isCorrectMC(selectedIndex, correctIndex)
//    - Short answer: isCorrectShortAnswer(userAnswer, correctAnswer)
// 3. calculateScore(answers) -> ScoreResult
// 4. Update MiniTest (score, totalPoints, timeSpent, completedAt)
// 5. Save MiniTestAnswers
// 6. If parent linked: create notification (test_complete)
```

## 6. Social Use Cases

| Use Case | Description |
|----------|-------------|
| FollowUserUseCase | Check canFollow (max 200), canSelfFollow, create pending Follow, notify target |
| RespondToFollowUseCase | Accept, reject, or block a follow request |
| ShareItemUseCase | Check isShareable (no original exams), create SharedItem, notify followers |
| GetFeedUseCase | Paginated feed from accepted follows |
| SearchUsersUseCase | Search users by nickname substring |

### Key Rules Enforced

- **Follow limit**: `followRules.canFollow(count)` -- max 200 following
- **Self-follow prevention**: `followRules.canSelfFollow(followerId, followingId)`
- **Share restriction**: `sharingRules.isShareable(itemType)` -- original exams NEVER shareable
- **Privacy**: all accounts private by default, follow requires approval

## 7. Parent Use Cases

| Use Case | Description |
|----------|-------------|
| GenerateLinkCodeUseCase | Verify user is student role, generate 6-char code via linkCodeRules, create pending ParentLink |
| LinkParentUseCase | Verify code exists, check not expired (24h via isCodeExpired), activate link, notify child |
| UnlinkParentUseCase | Either parent or child can revoke the link |
| GetDashboardUseCase | Aggregate child stats, apply parentPrivacyRules.filterForParent to strip forbidden data |

### Privacy Filtering (GetDashboardUseCase)

```typescript
async execute(input: GetDashboardInput): Promise<GetDashboardOutput> {
  // 1. Verify active ParentLink between parent and child
  // 2. Aggregate child data (exams, tests, answers, social)
  // 3. Apply filterForParent(fullData) -> ParentVisibleData
  //    - Included: weeklyStats, testScores, weaknessHeatmap, errorDistribution
  //    - EXCLUDED: original exam images, individual answers, social activity
  // 4. Return filtered dashboard
}
```

## 8. Payment Use Cases

| Use Case | Description |
|----------|-------------|
| CheckoutUseCase | Create payment session via IPaymentGateway, return sessionId + redirectUrl |
| ProcessWebhookUseCase | Verify webhook payload via IPaymentGateway, update Subscription + Credit records |
| CheckCreditsUseCase | Return current credit balance (total, used, remaining, plan, resetAt) |

### Credit Deduction Flow

```typescript
// In AnalyzeExamUseCase:
// 1. creditRules.hasSufficientCredits(credit, wrongCount) -> 402 if false
// 2. creditRepo.deduct(userId, wrongCount)  // atomic DB operation
// 3. Run pipeline
// 4. If pipeline partially fails, credits already deducted (no refund for partial)
//    User can retry failed questions without additional cost (cached results)
```

## 9. Error Handling

Each use case maps domain errors to appropriate HTTP-level error codes (returned as error types, not HTTP responses directly -- the presentation layer maps these):

| Error Type | HTTP Status | Example |
|-----------|-------------|---------|
| NotFoundError | 404 | Exam not found |
| UnauthorizedError | 401 | Not logged in |
| ForbiddenError | 403 | Not exam owner, parent accessing blocked data |
| InsufficientCreditsError | 402 | Not enough credits for analysis |
| ValidationError | 400 | Invalid input, bad status transition |
| ConflictError | 409 | Duplicate follow, already linked |
| ExpiredError | 410 | Link code expired, exam expired |
| PipelineStageError | 500 | AI API failure (retriable) |

### Stage-Level Retry

- Each AI pipeline stage (L1, L2, L3, L4) is independently retriable
- Intermediate results are persisted to DB after each stage
- Failed stages return partial results + error info
- Client can retry individual stages without re-running the entire pipeline
- Cached results are reused on retry (no duplicate cost)

## 10. Transaction Boundaries

### Credit Deduction Atomicity

Credit deduction must be atomic to prevent race conditions (concurrent exam analyses):

```typescript
// WRONG: check-then-deduct (race condition)
const credit = await creditRepo.findByUserId(userId);
if (hasSufficientCredits(credit, count)) {
  await creditRepo.deduct(userId, count); // another request may have deducted in between
}

// CORRECT: atomic deduct with constraint
// The repository implementation uses a DB transaction:
//   UPDATE credits SET used = used + $count
//   WHERE user_id = $userId AND (total - used) >= $count
//   RETURNING *;
// If no rows returned -> InsufficientCreditsError
const updatedCredit = await creditRepo.deduct(userId, count);
```

### Webhook Idempotency

ProcessWebhookUseCase must be idempotent. Use `transactionId` as idempotency key:
- Check if transaction already processed
- If yes, return success without side effects
- If no, update subscription + credits in a single transaction

## Additional Resources

- Use case catalog with full DTOs: `references/use-case-catalog.md`
- AI pipeline orchestration flow: `references/pipeline-flow.md`
- Domain entities and ports: see `studyai-domain` skill
- Business plan: `시험의신_통합_사업기획서_v2.md`
