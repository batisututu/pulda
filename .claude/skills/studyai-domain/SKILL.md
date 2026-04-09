---
name: studyai-domain
description: |
  Guide domain layer development following Clean Architecture for StudyAI (시험의 신).
  Use this skill when:
  - Defining or modifying domain entities (Exam, Question, Blueprint, ErrorDiagnosis, VariantQuestion, MiniTest, User, Credit)
  - Creating value objects (ErrorType, ExamStatus, QuestionType, Confidence, LinkCode, SubscriptionPlan, FollowStatus)
  - Defining port interfaces (repository ports, AI service ports, payment/storage/email gateway ports)
  - Writing or modifying domain business rules (exam expiry, credit logic, sharing rules, parent privacy, follow limits, scoring)
  - Ensuring the Dependency Rule: domain has ZERO imports from infrastructure, usecases, or presentation
  Do NOT use for: Database schema/SQL (use studyai-infrastructure). AI prompts/model config (use studyai-infrastructure). React components (use studyai-presentation). Use case orchestration (use studyai-usecases). Design/pen file work (use studyai-design).
---

# StudyAI Domain Layer Guide

The innermost layer of Clean Architecture. Contains business entities, value objects, port interfaces, and pure business rules. **ZERO external dependencies.**

## 1. Dependency Rule

`src/domain/` may only import from `src/shared/`.

**FORBIDDEN**: domain must NEVER import from `usecases/`, `infrastructure/`, or `presentation/`. No framework imports (no Supabase, no OpenAI, no Expo, no React Native, no React).

## 2. Project Structure

```
src/domain/
├── entities/           # Core business objects
│   ├── Exam.ts
│   ├── Question.ts
│   ├── Blueprint.ts
│   ├── ErrorDiagnosis.ts
│   ├── VariantQuestion.ts
│   ├── MiniTest.ts
│   ├── MiniTestAnswer.ts
│   ├── User.ts
│   ├── Credit.ts
│   ├── Subscription.ts
│   ├── Follow.ts
│   ├── SharedItem.ts
│   ├── ParentLink.ts
│   ├── Notification.ts
│   ├── Feedback.ts
│   └── QuestionCache.ts
├── value-objects/      # Immutable domain primitives
│   ├── ErrorType.ts
│   ├── ExamStatus.ts
│   ├── QuestionType.ts
│   ├── Difficulty.ts
│   ├── Confidence.ts
│   ├── LinkCode.ts
│   ├── SubscriptionPlan.ts
│   └── FollowStatus.ts
├── ports/              # Abstract contracts (interfaces)
│   ├── repositories/   # Data access contracts
│   └── gateways/       # External service contracts
└── rules/              # Pure business rule functions
    ├── examRules.ts
    ├── creditRules.ts
    ├── scoringRules.ts
    ├── sharingRules.ts
    ├── parentPrivacyRules.ts
    ├── followRules.ts
    ├── errorTypeDetection.ts
    └── linkCodeRules.ts
```

## 3. Entity Overview

| Entity | Key Fields | Description |
|--------|-----------|-------------|
| Exam | id, userId, imageUrl, ocrResult, status, expiresAt | 업로드된 시험지 |
| Question | id, examId, number, content(LaTeX), questionType, options, answer, studentAnswer, isCorrect | 개별 문항 |
| Blueprint | id, examId, unitDistribution, typeDistribution, difficultyDistribution, insights | 시험 분석 블루프린트 |
| ErrorDiagnosis | id, questionId, errorType, confidence, reasoning, correction, stepByStep, verificationResult | 오답 진단 |
| VariantQuestion | id, diagnosisId, content(LaTeX), questionType, options, answer, explanation, difficulty, targetErrorType | AI 생성 변형문항 |
| MiniTest | id, userId, variantIds, score, totalPoints, timeSpent, completedAt | 미니테스트 |
| MiniTestAnswer | id, testId, variantQuestionId, userAnswer, isCorrect, timeSpent | 미니테스트 답안 |
| User | id, authId, email, nickname, grade, schoolType, role(student/parent), avatarUrl | 사용자 |
| Credit | id, userId, plan, total, used, resetAt | 크레딧 잔량 |
| Subscription | id, userId, plan, status, portoneSubscriptionId, startedAt, expiresAt | 구독 |
| Follow | id, followerId, followingId, status | 팔로우 관계 |
| SharedItem | id, userId, itemType, itemId, visibility, caption | 공유 아이템 |
| ParentLink | id, parentUserId, childUserId, linkCode, status, linkedAt | 학부모-자녀 연동 |
| Notification | id, userId, type, title, body, isRead, data | 알림 |
| Feedback | id, userId, targetType, targetId, rating(-1/1) | 피드백 |
| QuestionCache | id, contentHash, classification, explanation, hitCount | 캐시 |

## 4. Value Objects

| Value Object | Values | Usage |
|-------------|--------|-------|
| ErrorType | `concept_gap` \| `calculation_error` \| `time_pressure` | 오답 3유형 분류 |
| ExamStatus | `processing` \| `ocr_done` \| `verified` \| `analyzed` \| `completed` \| `error` | 시험 처리 상태 |
| QuestionType | `multiple_choice` \| `short_answer` \| `essay` | 문항 유형 |
| Difficulty | `easy` \| `medium` \| `hard` | 난이도 |
| Confidence | 0.0 ~ 1.0 (bounded float) | AI 분석 신뢰도 |
| LinkCode | 6-char alphanumeric (no 0/O/1/I/l) | 학부모 연동 코드 |
| SubscriptionPlan | `free` \| `standard` \| `premium` \| `season_pass` \| `parent` | 구독 플랜 |
| FollowStatus | `pending` \| `accepted` \| `blocked` | 팔로우 상태 |

## 5. Port Interfaces

### Repository Ports (Data Access)

Interfaces defining data persistence contracts. See `references/ports.md` for complete signatures.

- `IExamRepository`, `IQuestionRepository`, `IBlueprintRepository`
- `IDiagnosisRepository`, `IVariantRepository`
- `IMiniTestRepository`, `IMiniTestAnswerRepository`
- `IUserRepository`, `ICreditRepository`, `ISubscriptionRepository`
- `ICacheRepository`, `IFeedbackRepository`
- `IParentLinkRepository`, `IFollowRepository`, `ISharedItemRepository`, `INotificationRepository`

### Gateway Ports (External Services)

- `IOcrGateway` — L1: OCR + 문항 분리
- `IClassifierGateway` — L2: 분류 + 블루프린트
- `IExplanationGateway` — L3: 해설 + 오답 진단
- `IVerifierGateway` — L3: 검증
- `IVariantGeneratorGateway` — L4: 변형문항 생성
- `IPaymentGateway` — 결제 세션 생성 + 웹훅 검증
- `IStorageGateway` — 파일 업로드/삭제/URL
- `IEmailGateway` — 이메일 발송

## 6. Business Rules

All rules are **pure functions** with no I/O or external dependencies. See `references/rules.md` for complete logic.

| Rule Module | Key Functions | Description |
|------------|---------------|-------------|
| examRules | canTransitionStatus, isExpired | 시험 상태 전이, 7일 만료 |
| creditRules | hasSufficientCredits, calculateCost, getPlanLimit | 크레딧 차감, 플랜별 한도 |
| scoringRules | normalizeAnswer, isCorrectMC, isCorrectShortAnswer, calculateScore | 채점 로직 |
| sharingRules | isShareable, isOriginalExam | **원본 시험지 공유 금지**, AI 생성물만 공유 |
| parentPrivacyRules | filterForParent | 학부모 열람 가능/불가 데이터 분리 |
| followRules | canFollow (max 200), isPrivateByDefault | 팔로우 제한 |
| errorTypeDetection | determineConfidence | 주-검증 답안 비교, 신뢰도 결정 |
| linkCodeRules | generateLinkCode, isCodeExpired (24h) | 연동 코드 생성/만료 |

## Additional Resources

- Entity TypeScript interfaces: `references/entities.md`
- Port interface catalog: `references/ports.md`
- Business rule specifications: `references/rules.md`
- Business plan: `시험의신_통합_사업기획서_v2.md`
