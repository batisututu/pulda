# Use Case Catalog

Complete catalog of 24 use cases in the StudyAI application layer. Each entry includes Input/Output DTOs, dependencies, execute flow, and error cases.

---

## Exam Pipeline

### 1. UploadExamUseCase

**Input DTO:**
```typescript
interface UploadExamInput {
  userId: string;
  file: File;          // image or PDF, max 10MB
}
```

**Output DTO:**
```typescript
interface UploadExamOutput {
  examId: string;
  imageUrl: string;
  status: ExamStatus;  // 'processing'
  expiresAt: Date;
}
```

**Dependencies:**
- `IExamRepository`
- `ICreditRepository`
- `IStorageGateway`

**Execute Flow:**
1. Validate file type (JPG, PNG, PDF) and size (max 10MB)
2. Load credit via `creditRepo.findByUserId(userId)`
3. Check `creditRules.hasSufficientCredits(credit, 1)` -- minimum 1 credit to upload
4. Upload file via `storageGateway.upload(userId, newExamId, file)` -- returns imageUrl
5. Create exam record via `examRepo.create({ userId, imageUrl, status: 'processing', expiresAt: getExpiryDate() })`
6. Return `{ examId, imageUrl, status: 'processing', expiresAt }`

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Invalid file type or exceeds 10MB |
| InsufficientCreditsError | 402 | No remaining credits |
| PipelineStageError | 500 | Storage upload failure |

---

### 2. RunOcrUseCase

**Input DTO:**
```typescript
interface RunOcrInput {
  userId: string;
  examId: string;
}
```

**Output DTO:**
```typescript
interface RunOcrOutput {
  examId: string;
  questions: OcrQuestion[];
  metadata: { totalQuestions: number; pageNumber: number; confidence: number };
  status: ExamStatus;  // 'ocr_done'
}
```

**Dependencies:**
- `IExamRepository`
- `IQuestionRepository`
- `IOcrGateway`
- `IStorageGateway`

**Execute Flow:**
1. Load exam via `examRepo.findById(examId)` -- verify ownership (userId match)
2. Validate status transition: `canTransitionStatus('processing', 'ocr_done')`
3. Get signed URL for exam image via `storageGateway.getSignedUrl(exam.imageUrl)`
4. Call `ocrGateway.processImage(imageBase64)` -- returns OcrResult
5. Create Question records via `questionRepo.createMany(ocrResult.questions)` with examId
6. Update exam: `examRepo.update(examId, { ocrResult, status: 'ocr_done' })`
7. Return questions + metadata + status

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Exam not found |
| ForbiddenError | 403 | userId does not match exam owner |
| ValidationError | 400 | Invalid status transition (not 'processing') |
| PipelineStageError | 500 | OCR gateway failure (retriable) |

---

### 3. VerifyQuestionsUseCase

**Input DTO:**
```typescript
interface VerifyQuestionsInput {
  userId: string;
  examId: string;
  corrections: {
    questionId: string;
    content?: string;          // corrected LaTeX content
    questionType?: QuestionType;
    options?: string[] | null;
    answer?: string | null;
    studentAnswer?: string | null;
    isCorrect?: boolean | null;
  }[];
}
```

**Output DTO:**
```typescript
interface VerifyQuestionsOutput {
  examId: string;
  questionCount: number;
  wrongCount: number;
  status: ExamStatus;  // 'verified'
}
```

**Dependencies:**
- `IExamRepository`
- `IQuestionRepository`

**Execute Flow:**
1. Load exam via `examRepo.findById(examId)` -- verify ownership
2. Validate status transition: `canTransitionStatus('ocr_done', 'verified')`
3. Apply user corrections via `questionRepo.updateMany(corrections)`
4. Count wrong answers: questions where `isCorrect === false`
5. Update exam status: `examRepo.update(examId, { status: 'verified' })`
6. Return examId, questionCount, wrongCount, status

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Exam or question not found |
| ForbiddenError | 403 | Not exam owner |
| ValidationError | 400 | Invalid status transition (not 'ocr_done') |

---

### 4. AnalyzeExamUseCase

**Input DTO:**
```typescript
interface AnalyzeExamInput {
  userId: string;
  examId: string;
}
```

**Output DTO:**
```typescript
interface AnalyzeExamOutput {
  examId: string;
  blueprint: Blueprint;
  diagnoses: ErrorDiagnosis[];
  variants: VariantQuestion[];
  creditsUsed: number;
  cacheHits: number;
  status: ExamStatus;  // 'analyzed'
}
```

**Dependencies:**
- `IExamRepository`
- `IQuestionRepository`
- `IBlueprintRepository`
- `IDiagnosisRepository`
- `IVariantRepository`
- `ICreditRepository`
- `ICacheRepository`
- `IClassifierGateway`
- `IExplanationGateway`
- `IVerifierGateway`
- `IVariantGeneratorGateway`

**Execute Flow:**
1. Load exam + questions via `examRepo.findById`, `questionRepo.findByExamId`
2. Verify ownership and status transition: `canTransitionStatus('verified', 'analyzed')`
3. Filter wrong questions: `questions.filter(q => q.isCorrect === false)`
4. Check credits: `creditRules.hasSufficientCredits(credit, wrongCount)` -- 402 if insufficient
5. **Cache check**: For each question, compute SHA-256 hash of normalized content, check `cacheRepo.findByHash(hash)`
6. **L2 Classification** (batch 5 questions/call):
   - Cache miss questions -> `classifierGateway.classifyBatch(questions, grade)`
   - Cache hit questions -> use cached ClassificationResult
   - Save new results to cache: `cacheRepo.upsert(hash, { classification })`
7. **L2 Blueprint**: `classifierGateway.generateBlueprint(allClassifications)` -> save via `blueprintRepo.create`
8. **L3 Explanation + Verification** (for each wrong question):
   a. Cache miss -> `explanationGateway.diagnose(question, studentAnswer, classification)`
   b. In parallel: `verifierGateway.verify(question)`
   c. Compute confidence: `determineConfidence(primaryAnswer, verifierAnswer, baseConfidence)`
   d. Save to cache: `cacheRepo.upsert(hash, { explanation })`
   e. Create ErrorDiagnosis via `diagnosisRepo.create`
9. **L4 Variant Generation** (for each diagnosis):
   - `variantGeneratorGateway.generate(diagnosis, originalQuestion, count=3)`
   - Save via `variantRepo.createMany`
10. **Deduct credits**: `creditRepo.deduct(userId, wrongCount)` -- atomic operation
11. Update exam status: `examRepo.update(examId, { status: 'analyzed' })`
12. Return blueprint + diagnoses + variants + stats

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Exam not found |
| ForbiddenError | 403 | Not exam owner |
| ValidationError | 400 | Invalid status transition (not 'verified') |
| InsufficientCreditsError | 402 | Not enough credits for wrongCount |
| ExpiredError | 410 | Exam has expired (7-day limit) |
| PipelineStageError | 500 | Any AI stage failure (L2/L3/L4 individually retriable) |

---

## Diagnosis

### 5. GetDiagnosisUseCase

**Input DTO:**
```typescript
interface GetDiagnosisInput {
  userId: string;
  examId: string;
}
```

**Output DTO:**
```typescript
interface GetDiagnosisOutput {
  examId: string;
  diagnoses: (ErrorDiagnosis & {
    question: Question;
    variants: VariantQuestion[];
  })[];
}
```

**Dependencies:**
- `IExamRepository`
- `IQuestionRepository`
- `IDiagnosisRepository`
- `IVariantRepository`

**Execute Flow:**
1. Load exam via `examRepo.findById(examId)` -- verify ownership
2. Load diagnoses via `diagnosisRepo.findByExamId(examId)`
3. For each diagnosis, load the associated question and variants
4. Return enriched diagnoses array

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Exam not found |
| ForbiddenError | 403 | Not exam owner |

---

### 6. GenerateVariantsUseCase

**Input DTO:**
```typescript
interface GenerateVariantsInput {
  userId: string;
  diagnosisId: string;
  count: number;       // default 3, max 5
}
```

**Output DTO:**
```typescript
interface GenerateVariantsOutput {
  diagnosisId: string;
  variants: VariantQuestion[];
  creditsUsed: number;
}
```

**Dependencies:**
- `IDiagnosisRepository`
- `IQuestionRepository`
- `IVariantRepository`
- `ICreditRepository`
- `ICacheRepository`
- `IVariantGeneratorGateway`

**Execute Flow:**
1. Load diagnosis via `diagnosisRepo.findByQuestionId` -- verify ownership through question -> exam chain
2. Check if variants already cached for this diagnosis
3. Check credits: `creditRules.hasSufficientCredits(credit, 1)` -- 1 credit per generation call
4. Call `variantGeneratorGateway.generate(diagnosis, originalQuestion, count)`
5. Save variants via `variantRepo.createMany`
6. Deduct credits: `creditRepo.deduct(userId, 1)`
7. Return new variants

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Diagnosis not found |
| ForbiddenError | 403 | Not owner |
| InsufficientCreditsError | 402 | Not enough credits |
| ValidationError | 400 | count < 1 or count > 5 |
| PipelineStageError | 500 | Variant generation failure (retriable) |

---

## Mini-test

### 7. CreateMiniTestUseCase

**Input DTO:**
```typescript
interface CreateMiniTestInput {
  userId: string;
  variantIds: string[];  // 1-20 variant question IDs
}
```

**Output DTO:**
```typescript
interface CreateMiniTestOutput {
  testId: string;
  questions: VariantQuestion[];
  totalQuestions: number;
}
```

**Dependencies:**
- `IMiniTestRepository`
- `IVariantRepository`

**Execute Flow:**
1. Validate variantIds: non-empty, max 20, no duplicates
2. Load variant questions via `variantRepo.findByIds(variantIds)` -- verify all exist
3. Create MiniTest: `miniTestRepo.create({ userId, variantIds, score: null, completedAt: null })`
4. Return testId + questions

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Empty variantIds, >20 items, duplicates, or not all IDs found |

---

### 8. SubmitAnswersUseCase

**Input DTO:**
```typescript
interface SubmitAnswersInput {
  userId: string;
  testId: string;
  answers: {
    variantQuestionId: string;
    userAnswer: string;
    timeSpent: number;   // seconds
  }[];
  totalTimeSpent: number; // seconds
}
```

**Output DTO:**
```typescript
interface SubmitAnswersOutput {
  testId: string;
  score: number;
  totalPoints: number;
  correctCount: number;
  totalQuestions: number;
  answers: (MiniTestAnswer & { correctAnswer: string })[];
}
```

**Dependencies:**
- `IMiniTestRepository`
- `IMiniTestAnswerRepository`
- `IVariantRepository`
- `INotificationRepository`
- `IParentLinkRepository`

**Execute Flow:**
1. Load MiniTest via `miniTestRepo.findById(testId)` -- verify ownership and not already completed
2. Load variant questions via `variantRepo.findByIds(miniTest.variantIds)`
3. For each answer, score using `scoringRules`:
   - Multiple choice: `isCorrectMC(selectedIndex, correctIndex)`
   - Short answer: `isCorrectShortAnswer(userAnswer, correctAnswer)`
4. Calculate aggregate: `calculateScore(answers)` -> ScoreResult
5. Save MiniTestAnswers: `answerRepo.createMany(scoredAnswers)`
6. Update MiniTest: `miniTestRepo.update(testId, { score, totalPoints, timeSpent: totalTimeSpent, completedAt: now() })`
7. Check for linked parent via `parentLinkRepo.findByChild(userId)`
8. If parent linked: `notificationRepo.create({ userId: parentUserId, type: 'test_complete', title: '...', data: { testId, score, total } })`
9. Return scored results

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Test not found |
| ForbiddenError | 403 | Not test owner |
| ConflictError | 409 | Test already completed |
| ValidationError | 400 | Answers don't match test variantIds |

---

### 9. GetResultsUseCase

**Input DTO:**
```typescript
interface GetResultsInput {
  userId: string;
  testId: string;
}
```

**Output DTO:**
```typescript
interface GetResultsOutput {
  test: MiniTest;
  answers: (MiniTestAnswer & {
    variantQuestion: VariantQuestion;
    originalDiagnosis: ErrorDiagnosis;
  })[];
  comparison: {
    originalWrongCount: number;
    variantCorrectCount: number;
    improvementRate: number;   // percentage
  };
}
```

**Dependencies:**
- `IMiniTestRepository`
- `IMiniTestAnswerRepository`
- `IVariantRepository`
- `IDiagnosisRepository`

**Execute Flow:**
1. Load MiniTest via `miniTestRepo.findById(testId)` -- verify ownership
2. Load answers via `answerRepo.findByTestId(testId)`
3. For each answer, load the variant question and its source diagnosis
4. Calculate comparison: original wrong count vs variant correct count
5. Return enriched results with comparison

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Test not found |
| ForbiddenError | 403 | Not test owner |
| ValidationError | 400 | Test not yet completed |

---

## Social

### 10. FollowUserUseCase

**Input DTO:**
```typescript
interface FollowUserInput {
  followerId: string;   // current user
  followingId: string;  // target user
}
```

**Output DTO:**
```typescript
interface FollowUserOutput {
  followId: string;
  status: FollowStatus;  // 'pending'
}
```

**Dependencies:**
- `IFollowRepository`
- `IUserRepository`
- `INotificationRepository`

**Execute Flow:**
1. Validate `canSelfFollow(followerId, followingId)` -- cannot follow yourself
2. Check existing follow: `followRepo.findBetween(followerId, followingId)` -- 409 if exists
3. Count current following: `followRepo.countFollowing(followerId)`
4. Validate `canFollow(currentCount)` -- max 200
5. Verify target user exists: `userRepo.findById(followingId)` -- 404 if not
6. Create follow: `followRepo.create({ followerId, followingId, status: 'pending' })`
7. Notify target: `notificationRepo.create({ userId: followingId, type: 'follow_request', ... })`
8. Return followId + status

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Self-follow attempt |
| ConflictError | 409 | Already following or pending |
| ValidationError | 400 | Max 200 following reached |
| NotFoundError | 404 | Target user not found |

---

### 11. RespondToFollowUseCase

**Input DTO:**
```typescript
interface RespondToFollowInput {
  userId: string;       // responding user (the one being followed)
  followId: string;
  action: 'accept' | 'reject' | 'block';
}
```

**Output DTO:**
```typescript
interface RespondToFollowOutput {
  followId: string;
  status: FollowStatus;  // 'accepted' | 'blocked'
}
```

**Dependencies:**
- `IFollowRepository`
- `INotificationRepository`

**Execute Flow:**
1. Load follow via `followRepo` -- verify `followingId === userId` (only the target can respond)
2. Validate current status is 'pending'
3. If 'accept': update status to 'accepted', notify follower
4. If 'reject': delete the follow record
5. If 'block': update status to 'blocked'
6. Return updated status

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Follow request not found |
| ForbiddenError | 403 | Not the target of the follow request |
| ValidationError | 400 | Follow is not in 'pending' status |

---

### 12. ShareItemUseCase

**Input DTO:**
```typescript
interface ShareItemInput {
  userId: string;
  itemType: 'variant_set' | 'error_note' | 'mini_test_result' | 'blueprint';
  itemId: string;
  visibility: 'followers_only' | 'public';
  caption?: string;
}
```

**Output DTO:**
```typescript
interface ShareItemOutput {
  sharedItemId: string;
  itemType: string;
  visibility: string;
}
```

**Dependencies:**
- `ISharedItemRepository`
- `IFollowRepository`
- `INotificationRepository`

**Execute Flow:**
1. Validate `sharingRules.isShareable(itemType)` -- original exams NEVER shareable
2. Verify the item exists and is owned by userId (check through entity chain)
3. Create shared item: `sharedItemRepo.create({ userId, itemType, itemId, visibility, caption })`
4. Get accepted followers: `followRepo.findByFollowing(userId)` filtered by status = 'accepted'
5. Notify followers: `notificationRepo.create` for each follower with type 'share_new'
6. Return sharedItemId

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Item type is 'exam' or 'exam_image' (not shareable) |
| NotFoundError | 404 | Item not found |
| ForbiddenError | 403 | Item not owned by user |

---

### 13. GetFeedUseCase

**Input DTO:**
```typescript
interface GetFeedInput {
  userId: string;
  page: number;       // 1-based
  limit: number;      // default 20, max 50
}
```

**Output DTO:**
```typescript
interface GetFeedOutput {
  items: (SharedItem & {
    user: { id: string; nickname: string; avatarUrl: string | null };
  })[];
  page: number;
  hasMore: boolean;
}
```

**Dependencies:**
- `ISharedItemRepository`
- `IUserRepository`

**Execute Flow:**
1. Validate pagination: page >= 1, 1 <= limit <= 50
2. Load feed via `sharedItemRepo.findFeed(userId, { page, limit: limit + 1 })` -- fetch limit+1 to determine hasMore
3. Determine `hasMore = items.length > limit`, then trim to limit
4. Enrich each item with user profile data
5. Return paginated feed

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Invalid page or limit |

---

### 14. SearchUsersUseCase

**Input DTO:**
```typescript
interface SearchUsersInput {
  userId: string;       // current user (for excluding self)
  query: string;        // nickname substring, min 2 chars
  limit?: number;       // default 10, max 20
}
```

**Output DTO:**
```typescript
interface SearchUsersOutput {
  users: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    grade: string | null;
    isFollowing: boolean;
  }[];
}
```

**Dependencies:**
- `IUserRepository`
- `IFollowRepository`

**Execute Flow:**
1. Validate query length >= 2
2. Search users: `userRepo.findByNickname(query, limit)` -- excludes current user
3. For each result, check follow status: `followRepo.findBetween(userId, resultUserId)`
4. Return enriched user list

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Query too short (< 2 chars) |

---

## Parent

### 15. GenerateLinkCodeUseCase

**Input DTO:**
```typescript
interface GenerateLinkCodeInput {
  userId: string;       // must be student role
}
```

**Output DTO:**
```typescript
interface GenerateLinkCodeOutput {
  linkCode: string;     // 6-char alphanumeric
  expiresAt: Date;      // 24 hours from now
}
```

**Dependencies:**
- `IUserRepository`
- `IParentLinkRepository`

**Execute Flow:**
1. Load user via `userRepo.findById(userId)`
2. Verify `user.role === 'student'` -- only students can generate codes
3. Check for existing pending links, invalidate if present
4. Generate code: `linkCodeRules.generateLinkCode()` -- 6-char, no ambiguous chars (0/O/1/I/l)
5. Create pending link: `parentLinkRepo.create({ childUserId: userId, linkCode: code, status: 'pending' })`
6. Calculate expiresAt (24 hours from now)
7. Return code + expiresAt

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ForbiddenError | 403 | User role is not 'student' |

---

### 16. LinkParentUseCase

**Input DTO:**
```typescript
interface LinkParentInput {
  parentUserId: string;  // must be parent role
  linkCode: string;      // 6-char code from child
}
```

**Output DTO:**
```typescript
interface LinkParentOutput {
  linkId: string;
  childUserId: string;
  childNickname: string;
  status: 'active';
}
```

**Dependencies:**
- `IUserRepository`
- `IParentLinkRepository`
- `INotificationRepository`

**Execute Flow:**
1. Load parent user, verify `role === 'parent'`
2. Find pending link: `parentLinkRepo.findByCode(linkCode)`
3. Verify link exists and status is 'pending' -- 404 if not found
4. Check expiry: `linkCodeRules.isCodeExpired(link.createdAt)` -- 410 if expired
5. Activate link: `parentLinkRepo.updateStatus(linkId, 'active', { parentUserId, linkedAt: now() })`
6. Notify child: `notificationRepo.create({ userId: childUserId, type: 'parent_linked', ... })`
7. Return link details with child info

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ForbiddenError | 403 | User role is not 'parent' |
| NotFoundError | 404 | Link code not found or not pending |
| ExpiredError | 410 | Link code expired (> 24 hours) |
| ConflictError | 409 | Parent-child pair already linked |

---

### 17. UnlinkParentUseCase

**Input DTO:**
```typescript
interface UnlinkParentInput {
  userId: string;       // either parent or child
  linkId: string;
}
```

**Output DTO:**
```typescript
interface UnlinkParentOutput {
  linkId: string;
  status: 'revoked';
}
```

**Dependencies:**
- `IParentLinkRepository`
- `INotificationRepository`

**Execute Flow:**
1. Load link via `parentLinkRepo` -- verify userId is either parentUserId or childUserId
2. Verify link status is 'active'
3. Revoke: `parentLinkRepo.updateStatus(linkId, 'revoked', { revokedAt: now() })`
4. Notify the other party
5. Return revoked status

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Link not found |
| ForbiddenError | 403 | User is not part of this link |
| ValidationError | 400 | Link is not in 'active' status |

---

### 18. GetDashboardUseCase

**Input DTO:**
```typescript
interface GetDashboardInput {
  parentUserId: string;
  childUserId: string;
}
```

**Output DTO:**
```typescript
interface GetDashboardOutput {
  childNickname: string;
  weeklyStats: { questionsSolved: number; studyTime: number; loginDays: number };
  testScores: { date: string; score: number; total: number }[];
  weaknessHeatmap: { unit: string; accuracy: number; questionCount: number }[];
  errorDistribution: { type: string; count: number }[];
}
```

**Dependencies:**
- `IParentLinkRepository`
- `IUserRepository`
- `IMiniTestRepository`
- `IMiniTestAnswerRepository`
- `IDiagnosisRepository`
- `IBlueprintRepository`

**Execute Flow:**
1. Verify active ParentLink between parentUserId and childUserId
2. Load child profile via `userRepo.findById(childUserId)`
3. Aggregate weekly stats: mini tests completed, time spent, login days
4. Aggregate test scores: recent mini test results
5. Build weakness heatmap: from blueprint unit distributions + diagnosis data
6. Build error distribution: count by errorType across all diagnoses
7. Apply `parentPrivacyRules.filterForParent(fullData)`:
   - **INCLUDED**: weeklyStats, testScores, weaknessHeatmap, errorDistribution
   - **EXCLUDED**: original exam images, individual answers, social activity
8. Return filtered dashboard

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | No active link between parent and child |
| ForbiddenError | 403 | Requesting user is not the linked parent |

---

## Payment

### 19. CheckoutUseCase

**Input DTO:**
```typescript
interface CheckoutInput {
  userId: string;
  plan: SubscriptionPlan;  // 'standard' | 'premium' | 'season_pass' | 'parent'
}
```

**Output DTO:**
```typescript
interface CheckoutOutput {
  sessionId: string;
  redirectUrl: string;
}
```

**Dependencies:**
- `IUserRepository`
- `IPaymentGateway`

**Execute Flow:**
1. Load user via `userRepo.findById(userId)`
2. Validate plan is a paid plan (not 'free')
3. Create payment session: `paymentGateway.createSession(userId, plan)`
4. Return sessionId + redirectUrl for PortOne redirect

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Plan is 'free' or invalid |
| PipelineStageError | 500 | Payment gateway failure |

---

### 20. ProcessWebhookUseCase

**Input DTO:**
```typescript
interface ProcessWebhookInput {
  payload: unknown;     // raw webhook payload from PortOne
}
```

**Output DTO:**
```typescript
interface ProcessWebhookOutput {
  userId: string;
  plan: SubscriptionPlan;
  status: 'success' | 'failed';
  transactionId: string;
}
```

**Dependencies:**
- `IPaymentGateway`
- `ISubscriptionRepository`
- `ICreditRepository`
- `INotificationRepository`

**Execute Flow:**
1. Verify webhook: `paymentGateway.verifyWebhook(payload)` -- validates signature
2. Extract userId, plan, status, transactionId
3. **Idempotency check**: lookup by transactionId, skip if already processed
4. If status === 'success':
   a. Create or update subscription: `subscriptionRepo.create({ userId, plan, status: 'active', ... })`
   b. Update credits: `creditRepo.update(userId, { plan, total: getPlanLimit(plan), used: 0, resetAt: +30days })`
   c. Notify user: `notificationRepo.create({ type: 'subscription_activated', ... })`
5. If status === 'failed': log and notify user
6. Return webhook processing result

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| UnauthorizedError | 401 | Invalid webhook signature |
| ValidationError | 400 | Malformed payload |

---

### 21. CheckCreditsUseCase

**Input DTO:**
```typescript
interface CheckCreditsInput {
  userId: string;
}
```

**Output DTO:**
```typescript
interface CheckCreditsOutput {
  plan: SubscriptionPlan;
  total: number;
  used: number;
  remaining: number;
  resetAt: Date;
}
```

**Dependencies:**
- `ICreditRepository`

**Execute Flow:**
1. Load credit via `creditRepo.findByUserId(userId)`
2. Calculate remaining: `creditRules.getRemainingCredits(credit)`
3. Check if reset is due: `creditRules.isResetDue(credit)` -- if yes, trigger reset
4. Return credit summary

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Credit record not found (should never happen if auth trigger works) |

---

## Common

### 22. GetNotificationsUseCase

**Input DTO:**
```typescript
interface GetNotificationsInput {
  userId: string;
  unreadOnly?: boolean;  // default false
  limit?: number;        // default 20, max 50
}
```

**Output DTO:**
```typescript
interface GetNotificationsOutput {
  notifications: Notification[];
  unreadCount: number;
}
```

**Dependencies:**
- `INotificationRepository`

**Execute Flow:**
1. Load notifications: `notificationRepo.findByUser(userId, { unreadOnly, limit })`
2. Count unread: filter notifications where `isRead === false`
3. Return notifications + unreadCount

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Invalid limit (< 1 or > 50) |

---

### 23. MarkNotificationReadUseCase

**Input DTO:**
```typescript
interface MarkNotificationReadInput {
  userId: string;
  notificationId?: string;  // if null, mark ALL as read
}
```

**Output DTO:**
```typescript
interface MarkNotificationReadOutput {
  markedCount: number;
}
```

**Dependencies:**
- `INotificationRepository`

**Execute Flow:**
1. If notificationId provided:
   a. Load notification, verify userId matches
   b. `notificationRepo.markRead(notificationId)`
   c. Return markedCount = 1
2. If notificationId is null (mark all):
   a. `notificationRepo.markAllRead(userId)`
   b. Return markedCount (number affected)

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| NotFoundError | 404 | Notification not found |
| ForbiddenError | 403 | Notification does not belong to user |

---

### 24. SubmitFeedbackUseCase

**Input DTO:**
```typescript
interface SubmitFeedbackInput {
  userId: string;
  targetType: 'explanation' | 'variant' | 'blueprint';
  targetId: string;
  rating: -1 | 1;     // thumbs down / thumbs up
}
```

**Output DTO:**
```typescript
interface SubmitFeedbackOutput {
  feedbackId: string;
  isNew: boolean;       // true if created, false if updated
}
```

**Dependencies:**
- `IFeedbackRepository`

**Execute Flow:**
1. Validate targetType is one of allowed types
2. Validate rating is -1 or 1
3. Upsert feedback: `feedbackRepo.upsert({ userId, targetType, targetId, rating })`
   - If existing feedback found: update rating, return `isNew: false`
   - If no existing feedback: create new, return `isNew: true`
4. Return feedbackId + isNew flag

**Errors:**
| Error | HTTP | Condition |
|-------|------|-----------|
| ValidationError | 400 | Invalid targetType or rating value |
