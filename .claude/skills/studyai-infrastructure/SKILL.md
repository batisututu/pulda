---
name: studyai-infrastructure
description: |
  Guide infrastructure/adapter layer development for StudyAI (시험의 신).
  This layer implements the port interfaces defined in the domain layer, connecting to
  concrete external services: Supabase (PostgreSQL, Auth, Storage, Realtime), AI APIs
  (OpenAI, Anthropic), PortOne payment, Resend email, and caching.
  Use this skill when:
  - Implementing repository adapters (Supabase ↔ domain entities)
  - Implementing AI gateway adapters (OpenAI, Anthropic API calls)
  - Working with Supabase database schema, migrations, RLS policies
  - Configuring Supabase Auth triggers and user provisioning
  - Implementing PortOne payment integration (checkout, webhooks, plans)
  - Managing Supabase Storage (exam-images bucket, upload, 7-day auto-delete)
  - Setting up Supabase Realtime subscriptions
  - Implementing email notifications via Resend
  - Building the question_cache system (SHA-256 hashing)
  - Writing shared AI infrastructure (retry, cost tracking, LaTeX validation)
  - Wiring the Composition Root (DI container mapping ports to adapters)
  - Writing Supabase Edge Functions that delegate to use cases (for server-side operations requiring secrets)
  Do NOT use for: Domain entities/ports/rules (use studyai-domain). Use case orchestration (use studyai-usecases). React Native components/UI (use studyai-presentation). Design/pen file work (use studyai-design).
---

# StudyAI Infrastructure Layer Guide

The outermost layer of Clean Architecture. Contains concrete implementations of domain port interfaces. **Depends inward on domain only.**

## 1. Dependency Rule

`src/infrastructure/` may import from:
- `src/domain/ports/` (interfaces to implement)
- `src/domain/entities/` (domain types for mapping)
- `src/domain/value-objects/` (domain primitives)
- `src/shared/` (utilities, constants, types)

**FORBIDDEN**: infrastructure must NEVER be imported by `src/domain/`. Domain has zero knowledge of infrastructure.

```
presentation → usecases → domain ← infrastructure
                            ↑            │
                            └────────────┘
                          (implements ports)
```

## 2. Project Structure

```
src/infrastructure/
├── repositories/          # Supabase repository adapters
│   ├── SupabaseExamRepository.ts
│   ├── SupabaseQuestionRepository.ts
│   ├── SupabaseBlueprintRepository.ts
│   ├── SupabaseDiagnosisRepository.ts
│   ├── SupabaseVariantRepository.ts
│   ├── SupabaseMiniTestRepository.ts
│   ├── SupabaseMiniTestAnswerRepository.ts
│   ├── SupabaseUserRepository.ts
│   ├── SupabaseCreditRepository.ts
│   ├── SupabaseSubscriptionRepository.ts
│   ├── SupabaseCacheRepository.ts
│   ├── SupabaseFeedbackRepository.ts
│   ├── SupabaseParentLinkRepository.ts
│   ├── SupabaseFollowRepository.ts
│   ├── SupabaseSharedItemRepository.ts
│   └── SupabaseNotificationRepository.ts
├── gateways/              # External service adapters
│   ├── ai/
│   │   ├── OpenAIOcrGateway.ts        # L1: GPT-4o-mini Vision
│   │   ├── OpenAIClassifierGateway.ts # L2: GPT-4o-mini JSON
│   │   ├── AnthropicExplanationGateway.ts  # L3a: Claude Sonnet
│   │   ├── OpenAIVerifierGateway.ts   # L3b: GPT-4o-mini
│   │   └── AnthropicVariantGateway.ts # L4: Claude 4.5 Sonnet
│   ├── PortOnePaymentGateway.ts
│   ├── SupabaseStorageGateway.ts
│   └── ResendEmailGateway.ts
├── ai/                    # Shared AI infrastructure
│   ├── retry.ts           # Exponential backoff retry
│   ├── costTracker.ts     # Token/cost logging
│   └── latexValidator.ts  # KaTeX parse validation
├── di/                    # Dependency injection
│   └── container.ts       # Composition root
├── mappers/               # Domain ↔ Persistence mappers
│   ├── ExamMapper.ts
│   ├── QuestionMapper.ts
│   ├── BlueprintMapper.ts
│   ├── DiagnosisMapper.ts
│   ├── VariantMapper.ts
│   └── ...
└── supabase/              # Supabase client setup
    ├── client.ts          # Mobile client (anon key, with expo-secure-store for auth persistence)
    └── edgeFunctions.ts   # Helper for calling Supabase Edge Functions
```

## 3. Repository Adapter Pattern

Each adapter implements a domain port, mapping between Supabase rows and domain entities.

```typescript
// src/infrastructure/repositories/SupabaseExamRepository.ts
import { IExamRepository } from '@/domain/ports/repositories/IExamRepository';
import { Exam } from '@/domain/entities/Exam';
import { createServerClient } from '@/infrastructure/supabase/server';

export class SupabaseExamRepository implements IExamRepository {
  private supabase = createServerClient();

  async findById(id: string): Promise<Exam | null> {
    const { data, error } = await this.supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data);
  }

  async create(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> {
    const { data, error } = await this.supabase
      .from('exams')
      .insert(this.toPersistence(exam))
      .select()
      .single();

    if (error) throw new Error(`Failed to create exam: ${error.message}`);
    return this.toDomain(data);
  }

  // ... other CRUD methods

  private toDomain(row: any): Exam {
    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      ocrResult: row.ocr_result,
      status: row.status,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
    };
  }

  private toPersistence(exam: Partial<Exam>): Record<string, unknown> {
    return {
      user_id: exam.userId,
      image_url: exam.imageUrl,
      ocr_result: exam.ocrResult,
      status: exam.status,
    };
  }
}
```

## 4. Database Schema

Complete SQL schema for all 16 tables. See `references/schema.md` for full CREATE TABLE statements.

| Table | Purpose |
|-------|---------|
| users | 사용자 프로필 (학생/학부모) |
| exams | 업로드 시험지 + OCR 결과 |
| questions | 개별 문항 (LaTeX) |
| blueprints | 시험 분석 블루프린트 |
| error_diagnoses | 오답 원인 진단 |
| variant_questions | AI 생성 변형문항 |
| mini_tests | 미니테스트 세션 |
| mini_test_answers | 미니테스트 답안 |
| credits | 크레딧 잔량 |
| subscriptions | 구독 상태 |
| question_cache | AI 결과 캐시 |
| feedbacks | 사용자 피드백 |
| parent_links | 학부모-자녀 연동 |
| follows | 팔로우 관계 |
| shared_items | 소셜 공유 아이템 |
| notifications | 알림 |

## 5. Row Level Security (RLS)

RLS is enabled on ALL tables. See `references/rls-policies.md` for complete SQL.

Key patterns:
- **Owner-only**: exams, mini_tests, credits, subscriptions (user_id = get_user_id())
- **Via parent join**: questions, blueprints (exam_id IN ...), error_diagnoses, variant_questions (via question → exam)
- **Dynamic social**: shared_items (owner OR accepted follower OR public)
- **Bidirectional**: parent_links, follows (either party can view)
- **Service-role only**: question_cache (no user-facing policies)
- **Storage**: exam-images bucket scoped by auth.uid() folder

## 6. Auth System Trigger

Supabase Auth trigger auto-provisions user profile and free credits on signup:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (auth_id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'student'));
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'student' THEN
    INSERT INTO credits (user_id, plan, total, used)
    SELECT id, 'free', 30, 0 FROM users WHERE auth_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

## 7. AI Service Adapters

| Layer | Port Interface | Adapter | Model | Purpose |
|-------|---------------|---------|-------|---------|
| L1 | IOcrGateway | OpenAIOcrGateway | GPT-4o-mini Vision | 시험지 이미지 → 문항 JSON 추출 |
| L2 | IClassifierGateway | OpenAIClassifierGateway | GPT-4o-mini (JSON mode) | 문항 분류 + 블루프린트 생성 |
| L3a | IExplanationGateway | AnthropicExplanationGateway | Claude Sonnet | 오답 진단 + 단계별 풀이 |
| L3b | IVerifierGateway | OpenAIVerifierGateway | GPT-4o-mini | 풀이 교차 검증 |
| L4 | IVariantGeneratorGateway | AnthropicVariantGateway | Claude 4.5 Sonnet | 교정 변형문항 생성 |

See `references/prompt-templates.md` for complete prompt templates per layer.

## 8. AI Shared Infrastructure

All AI gateway adapters share common infrastructure utilities:

### Retry with Exponential Backoff
- Max retries: 3
- Backoff: 1s → 2s → 4s (exponential)
- Retry on: 429 (rate limit), 500, 502, 503 errors

### Cost Tracking
- Log every API call: model, input_tokens, output_tokens, cost_usd, latency_ms
- Aggregate per user/exam for analytics

### LaTeX Validation
- Validate all AI-generated LaTeX using KaTeX.parse() before storing
- Strip or fix invalid LaTeX, flag for review if unfixable

## 9. PortOne Payment Plans

| Plan | Price | Monthly Credits | PortOne Config |
|------|-------|----------------|----------------|
| Free | 0 | 30 questions | N/A |
| Standard | 9,900 KRW/month | 150 questions | Recurring subscription |
| Premium | 19,900 KRW/month | 400 questions | Recurring subscription |
| Season Pass | 6,900 KRW/2 weeks | 150 questions | Recurring (14-day cycle) |
| Parent | 3,900 KRW/month | N/A (dashboard only) | Recurring subscription |
| Add-on | 100 KRW/question | 1 question | One-time payment |

### Credit Deduction Flow
1. Check `credits.used < credits.total` before pipeline
2. Return 402 if insufficient
3. Reserve credits (increment `used`) in DB transaction
4. Adjust after pipeline completes
5. Use DB transaction for race conditions

## 10. File Storage

### Supabase Storage Bucket: `exam-images`
- Path: `{user_id}/{exam_id}/{filename}`
- Max file size: 10MB
- Allowed types: JPG, PNG, PDF
- RLS: owner-only (scoped by auth.uid() folder)

### 7-Day Auto-Delete
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_exams()
RETURNS void AS $$
BEGIN
  DELETE FROM exams WHERE expires_at < now() AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily at 3 AM KST (18:00 UTC)
SELECT cron.schedule('cleanup-expired-exams', '0 18 * * *', 'SELECT cleanup_expired_exams()');
```

## 11. Email (Resend)

`ResendEmailGateway` implements `IEmailGateway`. Templates:

| Template | Trigger | Recipient |
|----------|---------|-----------|
| weakness_alert | Unit accuracy < 50% | Student + Parent |
| weekly_report | Every Sunday (cron) | Parent |
| inactivity | 7 days no login | Student |

Respect user notification preferences stored in user settings.

## 12. Caching (question_cache)

- Hash: SHA-256 of normalized question content
- Stores: classification (L2 result) + explanation (L3 result)
- `hit_count` incremented on cache hit
- Service-role only access (no user RLS)
- Bypass cache when student answer differs

```typescript
// React Native 환경에서는 expo-crypto 사용 (비동기)
import * as Crypto from 'expo-crypto';

async function hashQuestion(content: string): Promise<string> {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized
  );
}
```

## 13. Realtime Subscriptions

Three primary Supabase Realtime channels:

```typescript
// 1. Social feed: new shared items (INSERT on shared_items)
supabase.channel('social-feed').on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'shared_items' },
  (payload) => addToFeed(payload.new)
).subscribe();

// 2. Notifications (INSERT on notifications, filtered by user)
supabase.channel('notifications').on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
  (payload) => showNotification(payload.new)
).subscribe();

// 3. Pipeline status (UPDATE on exams, filtered by exam ID)
supabase.channel(`exam-${examId}`).on('postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'exams', filter: `id=eq.${examId}` },
  (payload) => updateStatus(payload.new.status)
).subscribe();
```

## 14. Environment Variables

```env
# Supabase (클라이언트용, 모바일 앱에 번들됨)
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# PortOne Payment (클라이언트용)
EXPO_PUBLIC_PORTONE_STORE_ID=...
EXPO_PUBLIC_PORTONE_CHANNEL_KEY=...
```

### ⚠️ Secret Key Security (CRITICAL)

아래 키들은 **절대 모바일 앱에 포함하지 마세요**. Supabase Edge Function 환경변수로만 설정합니다:

```env
# Supabase Edge Function env only
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PORTONE_API_SECRET=...
PORTONE_WEBHOOK_SECRET=...
RESEND_API_KEY=re_...
```

모바일 앱은 `EXPO_PUBLIC_*` 변수만 접근 가능합니다. AI API 호출, 결제 검증, 이메일 발송 등 서버 비밀키가 필요한 작업은 반드시 Supabase Edge Functions를 통해 수행합니다.

## Additional Resources

- Complete schema SQL: `references/schema.md`
- RLS policies SQL: `references/rls-policies.md`
- AI prompt templates: `references/prompt-templates.md`
- Adapter implementation patterns: `references/adapter-patterns.md`
- Domain port interfaces: See `studyai-domain` skill `references/ports.md`
