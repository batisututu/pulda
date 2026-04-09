# Adapter Implementation Patterns

Concrete patterns for implementing domain port interfaces in the infrastructure layer.

## 1. Repository Adapter Pattern

Repository adapters bridge domain entities to Supabase persistence. Each adapter implements a domain port interface and uses `toDomain`/`toPersistence` mappers to translate between camelCase domain entities and snake_case database rows.

### Full Example: SupabaseExamRepository

```typescript
// src/infrastructure/repositories/SupabaseExamRepository.ts
import { IExamRepository } from '@/domain/ports/repositories/IExamRepository';
import { Exam } from '@/domain/entities/Exam';
import { ExamStatus } from '@/domain/value-objects/ExamStatus';
import { createClient } from '@/infrastructure/supabase/client';

// NOTE: Mobile app uses anon-key client with RLS for user-scoped operations.
// For admin operations, use Supabase Edge Functions with service role key.

// Database row type (snake_case, matches Supabase schema)
interface ExamRow {
  id: string;
  user_id: string;
  image_url: string | null;
  ocr_result: Record<string, unknown> | null;
  status: string;
  created_at: string;
  expires_at: string;
}

export class SupabaseExamRepository implements IExamRepository {
  private get supabase() {
    return createClient();
  }

  async findById(id: string): Promise<Exam | null> {
    const { data, error } = await this.supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.toDomain(data as ExamRow);
  }

  async findByUserId(userId: string): Promise<Exam[]> {
    const { data, error } = await this.supabase
      .from('exams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return (data as ExamRow[]).map((row) => this.toDomain(row));
  }

  async create(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> {
    const { data, error } = await this.supabase
      .from('exams')
      .insert(this.toPersistence(exam))
      .select()
      .single();

    if (error) throw new Error(`Failed to create exam: ${error.message}`);
    return this.toDomain(data as ExamRow);
  }

  async update(id: string, updates: Partial<Exam>): Promise<Exam> {
    const { data, error } = await this.supabase
      .from('exams')
      .update(this.toPersistence(updates))
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update exam: ${error.message}`);
    return this.toDomain(data as ExamRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('exams')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`Failed to delete exam: ${error.message}`);
  }

  // --- Mappers ---

  private toDomain(row: ExamRow): Exam {
    return {
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url ?? undefined,
      ocrResult: row.ocr_result ?? undefined,
      status: row.status as ExamStatus,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
    };
  }

  private toPersistence(exam: Partial<Exam>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (exam.userId !== undefined) row.user_id = exam.userId;
    if (exam.imageUrl !== undefined) row.image_url = exam.imageUrl;
    if (exam.ocrResult !== undefined) row.ocr_result = exam.ocrResult;
    if (exam.status !== undefined) row.status = exam.status;
    if (exam.expiresAt !== undefined) row.expires_at = exam.expiresAt.toISOString();
    return row;
  }
}
```

### Key Rules for All Repository Adapters

1. Mobile app repositories use the anon-key client with RLS. Server-side operations (AI pipeline, admin) run in Supabase Edge Functions with service role key. **NEVER bundle the service role key in the mobile app.**
2. Map `camelCase` domain fields to `snake_case` database columns and back
3. Handle `null` vs `undefined` correctly (Supabase returns `null`, domain may use `undefined`)
4. Throw descriptive errors on Supabase failures
5. Use `.select()` after `.insert()` and `.update()` to return the created/updated row
6. Use lazy getter for supabase client to avoid initialization issues in edge runtime

## 2. AI Gateway Adapter Pattern (OpenAI)

AI gateway adapters implement domain gateway ports, calling external AI APIs and mapping responses back to domain types.

### Full Example: OpenAIOcrGateway (L1)

```typescript
// src/infrastructure/gateways/ai/OpenAIOcrGateway.ts
import OpenAI from 'openai';
import { IOcrGateway } from '@/domain/ports/gateways/IOcrGateway';
import { OcrResult } from '@/domain/entities/Exam';
import { withRetry } from '@/infrastructure/ai/retry';
import { costTracker } from '@/infrastructure/ai/costTracker';
import { latexValidator } from '@/infrastructure/ai/latexValidator';

const L1_SYSTEM_PROMPT = `You are a Korean math exam paper OCR specialist...`; // see prompt-templates.md

export class OpenAIOcrGateway implements IOcrGateway {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async processImage(imageBase64: string): Promise<OcrResult> {
    const response = await withRetry(async () => {
      const start = Date.now();

      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: L1_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all questions from this exam image.' },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });

      const latencyMs = Date.now() - start;

      // Track cost
      costTracker.log({
        model: 'gpt-4o-mini',
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
        latencyMs,
        layer: 'L1',
      });

      return completion;
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty OCR response');

    const parsed = JSON.parse(content) as OcrResult;

    // Validate LaTeX in all question content
    for (const question of parsed.questions) {
      question.content = latexValidator.validateAndFix(question.content);
    }

    return parsed;
  }
}
```

## 3. Anthropic Adapter Pattern

### Full Example: AnthropicExplanationGateway (L3a)

```typescript
// src/infrastructure/gateways/ai/AnthropicExplanationGateway.ts
import Anthropic from '@anthropic-ai/sdk';
import { IExplanationGateway } from '@/domain/ports/gateways/IExplanationGateway';
import { Question } from '@/domain/entities/Question';
import { ClassificationResult } from '@/domain/entities/Blueprint';
import { ExplanationResult } from '@/domain/entities/ErrorDiagnosis';
import { withRetry } from '@/infrastructure/ai/retry';
import { costTracker } from '@/infrastructure/ai/costTracker';
import { latexValidator } from '@/infrastructure/ai/latexValidator';

const L3_SYSTEM_PROMPT = `당신은 친절하고 전문적인 한국 수학 선생님입니다...`; // see prompt-templates.md

export class AnthropicExplanationGateway implements IExplanationGateway {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async diagnose(
    question: Question,
    studentAnswer: string,
    classification: ClassificationResult
  ): Promise<ExplanationResult> {
    const userPrompt = this.buildUserPrompt(question, studentAnswer, classification);

    const response = await withRetry(async () => {
      const start = Date.now();

      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: L3_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const latencyMs = Date.now() - start;

      costTracker.log({
        model: 'claude-sonnet-4-20250514',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        latencyMs,
        layer: 'L3a',
      });

      return message;
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Empty explanation response');
    }

    const parsed = JSON.parse(textBlock.text) as ExplanationResult;

    // Validate LaTeX in step_by_step
    if (parsed.step_by_step) {
      parsed.step_by_step = latexValidator.validateAndFix(parsed.step_by_step);
    }

    return parsed;
  }

  private buildUserPrompt(
    question: Question,
    studentAnswer: string,
    classification: ClassificationResult
  ): string {
    return `학생이 다음 문제를 틀렸습니다. 분석해주세요.

문제: ${question.content}
정답: ${question.answer}
학생 답: ${studentAnswer}
문제 유형: ${question.questionType}
단원: ${classification.unit}

JSON 형식으로 출력:
{
  "error_type": "concept_gap|calculation_error|time_pressure",
  "confidence": 0.95,
  "correct_answer": "정답",
  "step_by_step": "1단계: ... \\n2단계: ... \\n3단계: ...",
  "error_reasoning": "오답 원인 설명 (한국어)",
  "correction_guidance": "교정 안내 (한국어)"
}`;
  }
}
```

## 4. Shared AI Infrastructure

### 4a. Retry with Exponential Backoff

```typescript
// src/infrastructure/ai/retry.ts

interface RetryOptions {
  maxRetries?: number;      // default: 3
  baseDelayMs?: number;     // default: 1000
  retryableStatusCodes?: number[];  // default: [429, 500, 502, 503]
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    retryableStatusCodes = [429, 500, 502, 503],
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const statusCode = error?.status ?? error?.statusCode ?? error?.response?.status;
      const isRetryable = retryableStatusCodes.includes(statusCode);

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
```

### 4b. Cost Tracker

```typescript
// src/infrastructure/ai/costTracker.ts

interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  layer: 'L1' | 'L2' | 'L3a' | 'L3b' | 'L4';
}

// Pricing per 1M tokens (USD)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250514': { input: 5.0, output: 25.0 },
};

export const costTracker = {
  log(entry: CostEntry): void {
    const pricing = PRICING[entry.model];
    if (!pricing) {
      console.warn(`Unknown model pricing: ${entry.model}`);
      return;
    }

    const costUsd =
      (entry.inputTokens / 1_000_000) * pricing.input +
      (entry.outputTokens / 1_000_000) * pricing.output;

    console.log(
      `[AI Cost] ${entry.layer} | ${entry.model} | ` +
      `in=${entry.inputTokens} out=${entry.outputTokens} | ` +
      `$${costUsd.toFixed(6)} | ${entry.latencyMs}ms`
    );

    // TODO: Persist to analytics table for per-user/per-exam cost tracking
  },
};
```

### 4c. LaTeX Validator

```typescript
// src/infrastructure/ai/latexValidator.ts
import katex from 'katex';

export const latexValidator = {
  /**
   * Validate LaTeX string and attempt to fix common issues.
   * Returns the original or fixed string.
   */
  validateAndFix(text: string): string {
    // Extract all LaTeX segments: $...$ and $$...$$
    const latexPattern = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
    let match: RegExpExecArray | null;
    let result = text;

    while ((match = latexPattern.exec(text)) !== null) {
      const latex = match[1] ?? match[2];
      if (!latex) continue;

      try {
        katex.renderToString(latex, { throwOnError: true });
      } catch {
        // Attempt common fixes
        const fixed = this.attemptFix(latex);
        try {
          katex.renderToString(fixed, { throwOnError: true });
          result = result.replace(latex, fixed);
        } catch {
          // Mark as needing review but don't remove
          console.warn(`[LaTeX] Unfixable LaTeX: ${latex.substring(0, 50)}...`);
        }
      }
    }

    return result;
  },

  attemptFix(latex: string): string {
    let fixed = latex;
    // Fix unbalanced braces
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      fixed += '}'.repeat(openBraces - closeBraces);
    }
    // Fix common typos
    fixed = fixed.replace(/\\frac(?!{)/g, '\\frac{');
    fixed = fixed.replace(/\\sqrt(?![\[{])/g, '\\sqrt{');
    return fixed;
  },
};
```

### 4d. Question Cache

```typescript
// src/infrastructure/ai/questionCache.ts
import * as Crypto from 'expo-crypto';
import { ICacheRepository } from '@/domain/ports/repositories/ICacheRepository';

// React Native 환경: expo-crypto 사용 (비동기)
export async function hashQuestion(content: string): Promise<string> {
  const normalized = content.trim().replace(/\s+/g, ' ');
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized
  );
}

export class QuestionCacheService {
  constructor(private cacheRepo: ICacheRepository) {}

  async getClassification(content: string) {
    const hash = await hashQuestion(content);
    const cached = await this.cacheRepo.findByHash(hash);
    if (cached?.classification) {
      await this.cacheRepo.incrementHitCount(cached.id);
      return cached.classification;
    }
    return null;
  }

  async setClassification(content: string, classification: unknown) {
    const hash = await hashQuestion(content);
    await this.cacheRepo.upsert(hash, { classification });
  }

  async getExplanation(content: string) {
    const hash = await hashQuestion(content);
    const cached = await this.cacheRepo.findByHash(hash);
    if (cached?.explanation) {
      await this.cacheRepo.incrementHitCount(cached.id);
      return cached.explanation;
    }
    return null;
  }

  async setExplanation(content: string, explanation: unknown) {
    const hash = await hashQuestion(content);
    await this.cacheRepo.upsert(hash, { explanation });
  }
}
```

## 5. Composition Root Pattern

The DI container wires all port interfaces to their concrete adapter implementations. It is the single place where infrastructure knows about all adapters.

```typescript
// src/infrastructure/di/container.ts
import { SupabaseExamRepository } from '@/infrastructure/repositories/SupabaseExamRepository';
import { SupabaseQuestionRepository } from '@/infrastructure/repositories/SupabaseQuestionRepository';
import { SupabaseBlueprintRepository } from '@/infrastructure/repositories/SupabaseBlueprintRepository';
import { SupabaseDiagnosisRepository } from '@/infrastructure/repositories/SupabaseDiagnosisRepository';
import { SupabaseVariantRepository } from '@/infrastructure/repositories/SupabaseVariantRepository';
import { SupabaseMiniTestRepository } from '@/infrastructure/repositories/SupabaseMiniTestRepository';
import { SupabaseMiniTestAnswerRepository } from '@/infrastructure/repositories/SupabaseMiniTestAnswerRepository';
import { SupabaseUserRepository } from '@/infrastructure/repositories/SupabaseUserRepository';
import { SupabaseCreditRepository } from '@/infrastructure/repositories/SupabaseCreditRepository';
import { SupabaseSubscriptionRepository } from '@/infrastructure/repositories/SupabaseSubscriptionRepository';
import { SupabaseCacheRepository } from '@/infrastructure/repositories/SupabaseCacheRepository';
import { SupabaseFeedbackRepository } from '@/infrastructure/repositories/SupabaseFeedbackRepository';
import { SupabaseParentLinkRepository } from '@/infrastructure/repositories/SupabaseParentLinkRepository';
import { SupabaseFollowRepository } from '@/infrastructure/repositories/SupabaseFollowRepository';
import { SupabaseSharedItemRepository } from '@/infrastructure/repositories/SupabaseSharedItemRepository';
import { SupabaseNotificationRepository } from '@/infrastructure/repositories/SupabaseNotificationRepository';

import { OpenAIOcrGateway } from '@/infrastructure/gateways/ai/OpenAIOcrGateway';
import { OpenAIClassifierGateway } from '@/infrastructure/gateways/ai/OpenAIClassifierGateway';
import { AnthropicExplanationGateway } from '@/infrastructure/gateways/ai/AnthropicExplanationGateway';
import { OpenAIVerifierGateway } from '@/infrastructure/gateways/ai/OpenAIVerifierGateway';
import { AnthropicVariantGateway } from '@/infrastructure/gateways/ai/AnthropicVariantGateway';
import { PortOnePaymentGateway } from '@/infrastructure/gateways/PortOnePaymentGateway';
import { SupabaseStorageGateway } from '@/infrastructure/gateways/SupabaseStorageGateway';
import { ResendEmailGateway } from '@/infrastructure/gateways/ResendEmailGateway';

// Use case imports (for type reference)
import { UploadExamUseCase } from '@/usecases/UploadExamUseCase';
import { AnalyzeExamUseCase } from '@/usecases/AnalyzeExamUseCase';
// ... other use cases

// Singleton repository instances
const repos = {
  exam: new SupabaseExamRepository(),
  question: new SupabaseQuestionRepository(),
  blueprint: new SupabaseBlueprintRepository(),
  diagnosis: new SupabaseDiagnosisRepository(),
  variant: new SupabaseVariantRepository(),
  miniTest: new SupabaseMiniTestRepository(),
  miniTestAnswer: new SupabaseMiniTestAnswerRepository(),
  user: new SupabaseUserRepository(),
  credit: new SupabaseCreditRepository(),
  subscription: new SupabaseSubscriptionRepository(),
  cache: new SupabaseCacheRepository(),
  feedback: new SupabaseFeedbackRepository(),
  parentLink: new SupabaseParentLinkRepository(),
  follow: new SupabaseFollowRepository(),
  sharedItem: new SupabaseSharedItemRepository(),
  notification: new SupabaseNotificationRepository(),
};

// Singleton gateway instances
const gateways = {
  ocr: new OpenAIOcrGateway(),
  classifier: new OpenAIClassifierGateway(),
  explanation: new AnthropicExplanationGateway(),
  verifier: new OpenAIVerifierGateway(),
  variantGenerator: new AnthropicVariantGateway(),
  payment: new PortOnePaymentGateway(),
  storage: new SupabaseStorageGateway(),
  email: new ResendEmailGateway(),
};

// Factory functions for use cases (inject dependencies)
export const container = {
  repos,
  gateways,

  createUploadExamUseCase: () =>
    new UploadExamUseCase(repos.exam, repos.credit, gateways.storage),

  createAnalyzeExamUseCase: () =>
    new AnalyzeExamUseCase(
      repos.exam,
      repos.question,
      repos.blueprint,
      repos.diagnosis,
      repos.variant,
      repos.cache,
      gateways.ocr,
      gateways.classifier,
      gateways.explanation,
      gateways.verifier,
      gateways.variantGenerator
    ),

  // ... other use case factories
};
```

## 6. Use Case Invocation Patterns (Mobile App)

In the Expo/React Native mobile app, there are **no Next.js API routes**. Instead, two patterns are used:

### Pattern A: Direct DI Container Invocation (Client-Safe Operations)

For operations that only need the anon key (data reads/writes with RLS):

```typescript
// In a React Native screen or Zustand store action:
import { container } from '@/infrastructure/di/container';
import * as ImagePicker from 'expo-image-picker';

export default function UploadScreen() {
  const handleUpload = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;

    const useCase = container.createUploadExamUseCase();
    try {
      const exam = await useCase.execute({
        userId: currentUser.id,
        imageUri: result.assets[0].uri,
      });
      router.push(`/exam/${exam.id}/verify`);
    } catch (error: any) {
      if (error.name === 'InsufficientCreditsError') {
        Alert.alert('크레딧 부족', '크레딧을 충전해주세요.');
      }
    }
  };
  // ...
}
```

### Pattern B: Supabase Edge Functions (Server-Side Secrets Required)

For operations needing API keys (AI pipeline, payment verification, email):

```typescript
// supabase/functions/analyze-exam/index.ts (Deno Edge Function)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // 1. Authenticate via JWT
  const authHeader = req.headers.get('Authorization')!;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // 2. Parse request
  const { examId } = await req.json();

  // 3. Create use case and execute (has access to server-side API keys)
  const useCase = createAnalyzeExamUseCase(); // DI with server-side gateways
  const result = await useCase.execute({ examId, userId: user.id });

  // 4. Return response
  return new Response(JSON.stringify(result), { status: 200 });
});
```

Calling from the mobile app:

```typescript
// In a React Native screen or store:
const { data, error } = await supabase.functions.invoke('analyze-exam', {
  body: { examId },
});
```

### Invocation Pattern Rules

1. **No business logic** in screens or Edge Functions -- delegate to use cases
2. **Direct invocation (Pattern A)** for: data CRUD, scoring, follow/share, notifications
3. **Edge Functions (Pattern B)** for: AI pipeline (L1-L4), payment webhooks, email sending
4. **Never bundle secret keys** in the mobile app -- only `EXPO_PUBLIC_*` variables
5. **Error handling** in screens: catch domain errors and show user-friendly Korean alerts
6. **Return consistent shapes** from Edge Functions: `{ data }` for success, `{ error }` for failure