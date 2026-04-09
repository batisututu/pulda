# Port Interface Catalog

All ports live in `src/domain/ports/`. They define abstract contracts that infrastructure adapters implement.

## Repository Ports (`ports/repositories/`)

### IExamRepository
```typescript
export interface IExamRepository {
  findById(id: string): Promise<Exam | null>;
  findByUserId(userId: string): Promise<Exam[]>;
  create(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam>;
  update(id: string, data: Partial<Exam>): Promise<Exam>;
  delete(id: string): Promise<void>;
}
```

### IQuestionRepository
```typescript
export interface IQuestionRepository {
  findByExamId(examId: string): Promise<Question[]>;
  findById(id: string): Promise<Question | null>;
  create(question: Omit<Question, 'id' | 'createdAt'>): Promise<Question>;
  createMany(questions: Omit<Question, 'id' | 'createdAt'>[]): Promise<Question[]>;
  updateMany(questions: { id: string; data: Partial<Question> }[]): Promise<void>;
  deleteByExamId(examId: string): Promise<void>;
}
```

### IBlueprintRepository
```typescript
export interface IBlueprintRepository {
  findByExamId(examId: string): Promise<Blueprint | null>;
  create(blueprint: Omit<Blueprint, 'id' | 'createdAt'>): Promise<Blueprint>;
}
```

### IDiagnosisRepository
```typescript
export interface IDiagnosisRepository {
  findByQuestionId(questionId: string): Promise<ErrorDiagnosis | null>;
  findByExamId(examId: string): Promise<ErrorDiagnosis[]>;
  create(diagnosis: Omit<ErrorDiagnosis, 'id' | 'createdAt'>): Promise<ErrorDiagnosis>;
  createMany(diagnoses: Omit<ErrorDiagnosis, 'id' | 'createdAt'>[]): Promise<ErrorDiagnosis[]>;
}
```

### IVariantRepository
```typescript
export interface IVariantRepository {
  findByDiagnosisId(diagnosisId: string): Promise<VariantQuestion[]>;
  findByIds(ids: string[]): Promise<VariantQuestion[]>;
  create(variant: Omit<VariantQuestion, 'id' | 'createdAt'>): Promise<VariantQuestion>;
  createMany(variants: Omit<VariantQuestion, 'id' | 'createdAt'>[]): Promise<VariantQuestion[]>;
}
```

### IMiniTestRepository
```typescript
export interface IMiniTestRepository {
  findById(id: string): Promise<MiniTest | null>;
  findByUserId(userId: string): Promise<MiniTest[]>;
  create(test: Omit<MiniTest, 'id' | 'createdAt'>): Promise<MiniTest>;
  update(id: string, data: Partial<MiniTest>): Promise<MiniTest>;
}
```

### IMiniTestAnswerRepository
```typescript
export interface IMiniTestAnswerRepository {
  findByTestId(testId: string): Promise<MiniTestAnswer[]>;
  createMany(answers: Omit<MiniTestAnswer, 'id' | 'createdAt'>[]): Promise<MiniTestAnswer[]>;
}
```

### IUserRepository
```typescript
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByAuthId(authId: string): Promise<User | null>;
  findByNickname(query: string, limit?: number): Promise<User[]>;
  update(id: string, data: Partial<User>): Promise<User>;
}
```

### ICreditRepository
```typescript
export interface ICreditRepository {
  findByUserId(userId: string): Promise<Credit | null>;
  deduct(userId: string, amount: number): Promise<Credit>;
  reset(userId: string, plan: SubscriptionPlan): Promise<Credit>;
  update(userId: string, data: Partial<Credit>): Promise<Credit>;
}
```

### ISubscriptionRepository
```typescript
export interface ISubscriptionRepository {
  findByUserId(userId: string): Promise<Subscription | null>;
  findActive(userId: string): Promise<Subscription | null>;
  create(sub: Omit<Subscription, 'id' | 'createdAt'>): Promise<Subscription>;
  cancel(id: string): Promise<void>;
}
```

### ICacheRepository
```typescript
export interface ICacheRepository {
  findByHash(contentHash: string): Promise<QuestionCache | null>;
  upsert(hash: string, data: Partial<QuestionCache>): Promise<QuestionCache>;
  incrementHitCount(id: string): Promise<void>;
}
```

### IFeedbackRepository
```typescript
export interface IFeedbackRepository {
  findByTarget(targetType: string, targetId: string, userId: string): Promise<Feedback | null>;
  upsert(feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<Feedback>;
}
```

### IParentLinkRepository
```typescript
export interface IParentLinkRepository {
  findByParent(parentUserId: string): Promise<ParentLink[]>;
  findByChild(childUserId: string): Promise<ParentLink[]>;
  findByCode(code: string): Promise<ParentLink | null>;
  create(link: Omit<ParentLink, 'id' | 'createdAt'>): Promise<ParentLink>;
  updateStatus(id: string, status: string, extraData?: Partial<ParentLink>): Promise<ParentLink>;
}
```

### IFollowRepository
```typescript
export interface IFollowRepository {
  findByFollower(followerId: string): Promise<Follow[]>;
  findByFollowing(followingId: string): Promise<Follow[]>;
  findBetween(followerId: string, followingId: string): Promise<Follow | null>;
  create(follow: Omit<Follow, 'id' | 'createdAt'>): Promise<Follow>;
  updateStatus(id: string, status: FollowStatus): Promise<Follow>;
  delete(id: string): Promise<void>;
  countFollowing(followerId: string): Promise<number>;
}
```

### ISharedItemRepository
```typescript
export interface ISharedItemRepository {
  findFeed(userId: string, options: { page: number; limit: number }): Promise<SharedItem[]>;
  findByUser(userId: string): Promise<SharedItem[]>;
  create(item: Omit<SharedItem, 'id' | 'createdAt'>): Promise<SharedItem>;
  delete(id: string): Promise<void>;
}
```

### INotificationRepository
```typescript
export interface INotificationRepository {
  findByUser(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}
```

## Gateway Ports (`ports/gateways/`)

### IOcrGateway (L1)
```typescript
export interface IOcrGateway {
  processImage(imageBase64: string): Promise<OcrResult>;
}
```

### IClassifierGateway (L2)
```typescript
export interface IClassifierGateway {
  classify(question: Question, grade: string): Promise<ClassificationResult>;
  classifyBatch(questions: Question[], grade: string): Promise<ClassificationResult[]>;
  generateBlueprint(classifications: ClassificationResult[]): Promise<Omit<Blueprint, 'id' | 'examId' | 'createdAt'>>;
}
```

### IExplanationGateway (L3a)
```typescript
export interface IExplanationGateway {
  diagnose(
    question: Question,
    studentAnswer: string,
    classification: ClassificationResult
  ): Promise<ExplanationResult>;
}
```

### IVerifierGateway (L3b)
```typescript
export interface IVerifierGateway {
  verify(question: Question): Promise<{ answer: string; briefSolution: string }>;
}
```

### IVariantGeneratorGateway (L4)
```typescript
export interface IVariantGeneratorGateway {
  generate(
    diagnosis: ErrorDiagnosis,
    originalQuestion: Question,
    count: number
  ): Promise<VariantGenerationResult>;
}
```

### IPaymentGateway
```typescript
export interface IPaymentGateway {
  createSession(userId: string, plan: SubscriptionPlan): Promise<{
    sessionId: string;
    redirectUrl: string;
  }>;
  verifyWebhook(payload: unknown): Promise<{
    userId: string;
    plan: SubscriptionPlan;
    status: 'success' | 'failed';
    transactionId: string;
  }>;
}
```

### IStorageGateway
```typescript
export interface IStorageGateway {
  upload(userId: string, examId: string, file: File): Promise<string>; // returns URL
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
}
```

### IEmailGateway
```typescript
export interface IEmailGateway {
  send(to: string, template: string, data: Record<string, unknown>): Promise<void>;
}
```
