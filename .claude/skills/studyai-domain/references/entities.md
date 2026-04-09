# Domain Entity TypeScript Interfaces

All entities live in `src/domain/entities/`. No framework dependencies.

## Core Entities

### Exam
```typescript
export interface Exam {
  id: string;
  userId: string;
  imageUrl: string | null;
  ocrResult: OcrResult | null;
  status: ExamStatus;
  createdAt: Date;
  expiresAt: Date; // default: now + 7 days
}
```

### Question
```typescript
export interface Question {
  id: string;
  examId: string;
  number: number;
  content: string;          // LaTeX string
  questionType: QuestionType;
  options: string[] | null; // ①②③④⑤ for MC
  answer: string | null;
  studentAnswer: string | null;
  isCorrect: boolean | null;
  points: number | null;
  createdAt: Date;
}
```

### Blueprint
```typescript
export interface Blueprint {
  id: string;
  examId: string;
  unitDistribution: Record<string, number>;    // { "함수": 0.4, "확률과통계": 0.25, ... }
  typeDistribution: Record<string, number>;    // { "multiple_choice": 0.75, ... }
  difficultyDistribution: Record<string, number>; // { "easy": 0.3, "medium": 0.45, ... }
  insights: string[] | null;                   // Korean insight sentences
  createdAt: Date;
}
```

### ErrorDiagnosis
```typescript
export interface ErrorDiagnosis {
  id: string;
  questionId: string;
  errorType: ErrorType;
  confidence: number;       // 0.0 - 1.0
  reasoning: string;        // Korean explanation
  correction: string;       // Korean correction guidance
  stepByStep: string | null; // Step-by-step solution with LaTeX
  verificationResult: VerificationResult | null;
  createdAt: Date;
}

export interface VerificationResult {
  verified: boolean;
  verifierAnswer: string;
  match: boolean;
}
```

### VariantQuestion
```typescript
export interface VariantQuestion {
  id: string;
  diagnosisId: string;
  content: string;          // LaTeX string
  questionType: QuestionType;
  options: string[] | null; // 5 options for MC
  answer: string;
  explanation: string;      // Step-by-step with LaTeX
  difficulty: Difficulty;
  targetErrorType: ErrorType | null;
  createdAt: Date;
}
```

### MiniTest
```typescript
export interface MiniTest {
  id: string;
  userId: string;
  variantIds: string[];
  score: number | null;
  totalPoints: number | null;
  timeSpent: number | null; // seconds
  completedAt: Date | null;
  createdAt: Date;
}
```

### MiniTestAnswer
```typescript
export interface MiniTestAnswer {
  id: string;
  testId: string;
  variantQuestionId: string;
  userAnswer: string | null;
  isCorrect: boolean | null;
  timeSpent: number | null; // seconds
  createdAt: Date;
}
```

## User & Payment Entities

### User
```typescript
export interface User {
  id: string;
  authId: string;
  email: string;
  nickname: string;
  grade: string | null;     // 'mid1'~'mid3', 'high1'~'high3'
  schoolType: string | null; // 'middle' | 'high'
  role: 'student' | 'parent';
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Credit
```typescript
export interface Credit {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  total: number;    // max questions for current period
  used: number;     // questions used
  resetAt: Date;    // next reset date
}
```

### Subscription
```typescript
export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  portoneSubscriptionId: string | null;
  startedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
}
```

## Cache & Feedback

### QuestionCache
```typescript
export interface QuestionCache {
  id: string;
  contentHash: string;      // SHA-256 of normalized question text
  classification: ClassificationResult | null;
  explanation: ExplanationResult | null;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Feedback
```typescript
export interface Feedback {
  id: string;
  userId: string;
  targetType: 'explanation' | 'variant' | 'blueprint';
  targetId: string;
  rating: -1 | 1;          // thumbs down / up
  createdAt: Date;
}
```

## Social Entities

### ParentLink
```typescript
export interface ParentLink {
  id: string;
  parentUserId: string;
  childUserId: string;
  linkCode: string | null;  // 6-char code
  status: 'pending' | 'active' | 'revoked';
  linkedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
```

### Follow
```typescript
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: Date;
}
```

### SharedItem
```typescript
export interface SharedItem {
  id: string;
  userId: string;
  itemType: 'variant_set' | 'error_note' | 'mini_test_result' | 'blueprint';
  itemId: string;
  visibility: 'followers_only' | 'public';
  caption: string | null;
  createdAt: Date;
}
// IMPORTANT: Original exam papers are NEVER shareable (copyright protection)
```

### Notification
```typescript
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  data: Record<string, unknown> | null;
  createdAt: Date;
}
```

## AI Pipeline Output Types

### OcrResult (L1 Output)
```typescript
export interface OcrResult {
  questions: OcrQuestion[];
  metadata: {
    totalQuestions: number;
    pageNumber: number;
    confidence: number;
  };
}

export interface OcrQuestion {
  number: number;
  content: string;          // LaTeX
  type: QuestionType;
  options: string[] | null;
  answer: string | null;
  points: number | null;
  needsReview: boolean;
}
```

### ClassificationResult (L2 Output)
```typescript
export interface ClassificationResult {
  questionId: string;
  subject: string;
  unit: string;             // e.g., "이차함수"
  subUnit: string;          // e.g., "꼭짓점과 축"
  difficulty: Difficulty;
  questionType: QuestionType;
  reasoning: string;        // Korean
}
```

### ExplanationResult (L3 Output)
```typescript
export interface ExplanationResult {
  questionId: string;
  errorType: ErrorType;
  confidence: number;
  correctAnswer: string;
  stepByStep: string;       // with LaTeX
  errorReasoning: string;   // Korean
  correctionGuidance: string; // Korean
  verification: VerificationResult;
}
```

### VariantGenerationResult (L4 Output)
```typescript
export interface VariantGenerationResult {
  diagnosisId: string;
  variants: {
    content: string;        // LaTeX
    type: QuestionType;
    options: string[] | null;
    answer: string;
    explanation: string;
    difficulty: Difficulty;
    targetErrorType: ErrorType;
  }[];
}
```

## Value Object Types

```typescript
export type ErrorType = 'concept_gap' | 'calculation_error' | 'time_pressure';
export type ExamStatus = 'processing' | 'ocr_done' | 'verified' | 'analyzed' | 'completed' | 'error';
export type QuestionType = 'multiple_choice' | 'short_answer' | 'essay';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type SubscriptionPlan = 'free' | 'standard' | 'premium' | 'season_pass' | 'parent';
export type FollowStatus = 'pending' | 'accepted' | 'blocked';
```
