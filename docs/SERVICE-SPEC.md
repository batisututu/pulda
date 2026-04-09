# ExamGod (시험의 신) — Service Specification

> Upload exam → AI analysis → Correction drills → Solve on mobile → Share with friends

Solo dev · Next.js 15 + Supabase + Vercel · Middle/High school math MVP

---

## 1. Product Overview

ExamGod converts an uploaded exam paper into a personalized study plan: blueprint (exam structure), 3-type error diagnosis, correction variant drills — solvable on mobile, shareable with friends.

**Differentiator**: QANDA solves 1 problem. ExamGod analyzes an entire exam paper.

---

## 2. User Flow (6-Stage Pipeline)

| Step | User Action | AI Processing | Output |
|------|-----------|--------------|--------|
| 1 | Upload exam photo/PDF | GPT-4o-mini Vision: OCR + question split | Structured question JSON |
| 2 | Verify split (UI) | User confirms/edits | Verified question cards |
| 3 | - | Unit/type/difficulty classification | Exam Blueprint |
| 4 | Mark wrong answers | Error cause (3 types) + solution + dual verification | Error diagnosis + explanation |
| 5 | - | Correction variant generation (10-20) | Correction variant set |
| 6 | Solve on mobile | Grading + score prediction | Score + recommendation + share option |

---

## 3. Features

### 3.1 Exam Blueprint

Extracts unit/type/difficulty/points distribution. Accumulates across exams for school-specific pattern estimation.

### 3.2 3-Type Error Classification

| Error Type | AI Criteria | Correction |
|-----------|------------|------------|
| `concept_gap` | Wrong on basic problems / misused formulas | Concept card + 5 basic variants |
| `calculation_error` | Correct approach but arithmetic/sign mistakes | Same-structure numeric variants (5) with traps |
| `time_pressure` | Got easy ones right, missed hard ones only | Timed mini-test (5 problems/10min) + speed tips |

### 3.3 Correction Variant Engine

Generates 10-20 variants per wrong answer. Strategy varies by error type: concept_gap → different context, calculation_error → changed numbers + traps, time_pressure → speed drills. All numbers/expressions changed from original (copyright).

### 3.4 Mobile Solving Canvas

| Mode | Description | UI |
|------|-----------|-----|
| Multiple choice | Tap 5 options | Option cards + confirm |
| Short answer | Math keypad input | Custom keypad (fraction/root/exponent) |
| Essay canvas | Pen/finger writing (Phase 2: AI grading) | Canvas + image save |
| Timed mini-test | Time limit + sequential | Timer bar + question nav |

Tech: React + KaTeX + HTML5 Canvas + Zustand + PWA (next-pwa/Serwist).
Mobile: Responsive 320-1440px, touch ≥44px, KaTeX ≥16px, auto-save (localStorage + Supabase sync).

### 3.5 Parent Dashboard

**Linking**: Child generates 6-digit code → Parent enters → Dashboard activates. Child revokes anytime. Max 5 children/parent.

| Section | Data | Update |
|---------|------|--------|
| Learning summary | Problems solved, study time, active days | Realtime |
| Weakness heatmap | Unit-level accuracy (red = weak) | Per exam |
| Score trend graph | Mini-test scores over time | Per test |
| Error pattern report | Concept/Calculation/Time ratio | Weekly |
| Exam schedule | D-day + recommended plan | Manual |
| Activity alerts | Upload/test completion | Event-based |

**Privacy**: Parent sees aggregated stats only. NO original exams, individual answers, or social activity. Child-initiated linking, child-controlled revocation.

### 3.6 Social Learning

**Follow**: Nickname search (no real names), approval required (private default), max 200 followers.

| Shareable Content | Rule |
|------------------|------|
| Variant question sets | AI-generated only. Original exam NEVER shareable |
| Error notes | Scores/answers optionally hidden |
| Mini-test results | Score + accuracy only |
| Blueprint | School name hidden option |

**Safety**: Follow approval, max 200, content reporting, block, NO DM, NO text, learning content only.

### 3.7 Trust & Quality

- **Dual verification**: Claude solves → GPT checks → mismatch = "low confidence" badge
- **Evidence**: 1-line classification reasoning shown
- **Feedback**: Thumbs up/down → auto-flag low quality → prompt improvement

### 3.8 MVP vs Phase 2

| Area | MVP (8 weeks) | Phase 2 |
|------|--------------|---------|
| Scan | GPT-4o-mini Vision OCR+split, verify UI, blueprint | Science subjects, cross-subject |
| Error correction | 3-type, 10-20 variants, 10-min routine | Review schedule, mistake patterns |
| Mobile solving | MC/short answer, timer, math keypad | Essay AI grading, Flutter native |
| Parent | Code linking, dashboard, heatmap | KakaoTalk report, academy dashboard |
| Social | Follow/share/feed | League, school ranking, group study |
| Payment | Credits, PortOne, season pass | B2B academy license |

---

## 4. Technical Architecture

### 4.1 System Layers

```
CLIENT: Next.js 15 (Vercel) + PWA + React Components
  ExamUploader | BlueprintViewer | ExamSolver | ParentDashboard | SocialFeed | MathKeypad

SERVER ACTIONS: src/lib/actions/ (exam, analysis, solver, social, parent)
  API Routes: webhook-pg, cron/cleanup, cron/weekly-report
  Middleware: auth check, rate limit, credit check

AI PIPELINE: src/lib/ai/pipeline.ts
  Retry (exp backoff, max 3) | Timeout (30s/20s/60s/60s) | Cache (content_hash) | Cost tracking

DATA: Supabase (PostgreSQL + RLS + Realtime + Auth + Storage)
  Auth: Email + Kakao + Google | Storage: exam-images/ (7-day auto-delete)
```

### 4.2 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Solver UI | React + KaTeX + HTML5 Canvas |
| Math Keypad | Custom React component |
| Client State | Zustand |
| PWA | next-pwa (Serwist) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage + RLS + Realtime) |
| Deploy | Vercel (icn1 Seoul) |
| OCR + Split | GPT-4o-mini Vision |
| Classification | GPT-4o-mini (JSON Structured Output) |
| Explanation/Gen | Claude 4.5 Sonnet |
| Verification | GPT-4o-mini |
| Math Rendering | KaTeX |
| Payment | PortOne V2 |
| Email | Resend |

### 4.3 AI Pipeline

#### Model Tiers

| Tier | Role | Model | Cost/call | Timeout |
|------|------|-------|-----------|---------|
| L1 | OCR + question split | GPT-4o-mini Vision | ~$0.008 | 30s |
| L2 | Classification + blueprint | GPT-4o-mini JSON | ~$0.003 | 20s |
| L3a | Explanation + error analysis | Claude Sonnet | ~$0.03 | 60s |
| L3b | Verification (dual check) | GPT-4o-mini | ~$0.006 | 20s |
| L4 | Correction variant gen | Claude Sonnet | ~$0.03 | 60s |

**Cost per exam (20 questions, 7 wrong)**: $0.473 (~₩630). Cache saves 20-30% on repeats.

#### L1 Prompt: OCR + Question Split

```
System:
You are a Korean middle/high school math exam OCR expert.
Analyze exam images and split into structured question JSON.

Rules:
1. Extract question number, body, choices (if MC), points accurately
2. Convert math to LaTeX (e.g., $x^2 + 3x + 2 = 0$)
3. Replace figures with [Figure: description]
4. Provide OCR confidence 0.0-1.0
5. Use null for invisible point values

Response JSON:
{
  "exam_info": {
    "subject": "math", "grade": "high2",
    "exam_type": "midterm_1", "total_questions": 20, "confidence": 0.92
  },
  "questions": [{
    "number": 1,
    "type": "multiple_choice" | "short_answer" | "essay",
    "content": "...(LaTeX)...",
    "options": ["① ...", "② ..."] | null,
    "points": 4 | null,
    "has_figure": false,
    "figure_description": null,
    "ocr_confidence": 0.95
  }]
}
```

#### L3a Prompt: Explanation + Error Analysis

```
System:
You are a Korean math teacher. Diagnose wrong answers.

Error types:
- concept_gap: Misused formulas, definition misunderstanding
- calculation_error: Sign errors, arithmetic mistakes
- time_pressure: Correct approach but incomplete

Rules:
1. Step-by-step solution with concept labels
2. Pinpoint specific mistake
3. Reasoning for error type classification
4. Mark confidence < 0.7 explicitly
5. All math in LaTeX

Response JSON:
{
  "solution": {
    "steps": [{"step": 1, "content": "...", "concept": "quadratic vertex formula"}],
    "final_answer": "..."
  },
  "error_analysis": {
    "error_type": "concept_gap" | "calculation_error" | "time_pressure",
    "error_type_confidence": 0.85,
    "reasoning": "...",
    "specific_mistake": "...",
    "correction_hint": "..."
  }
}
```

#### L4 Prompt: Correction Variants

```
System:
You are a Korean math question creator. Generate correction variants by error type.

Strategies:
- concept_gap → Same concept, different context (basic → applied)
- calculation_error → Same structure + changed numbers + trap choices
- time_pressure → Speed practice (include shortcut tips)

Rules:
1. Completely change numbers/expressions (copyright)
2. Include answer + explanation per variant
3. Tag difficulty: easy/medium/hard
4. LaTeX for all math

Response JSON:
{
  "variants": [{
    "id": "v1",
    "type": "multiple_choice",
    "difficulty": "easy",
    "content": "...(LaTeX)...",
    "options": ["① ...", ...],
    "correct_answer": "① ...",
    "explanation": "...",
    "target_skill": "...",
    "trap_description": "..."
  }]
}
```

#### Error Handling

| Scenario | Action |
|----------|--------|
| API fail | Retry exp backoff (2s→4s→8s), max 3 |
| JSON parse fail | Retry stricter prompt, max 3. Then: partial save + notify user |
| 429 Rate Limit | Exp backoff, queue remaining |
| 500 Server Error | Fallback model (L3: Claude fail → GPT-4o) |
| Timeout | Per-stage limits, retry once |
| OCR confidence < 0.7 | "Needs verification" badge, user confirms |
| Dual verify mismatch | "Low confidence" badge, collect feedback |

### 4.4 Database Schema

#### ERD

```
users 1──N exams 1──N questions
  │                    ├── 1──1 blueprints
  │                    └── 1──0..1 error_diagnoses 1──N variant_questions
  ├── 1──N mini_tests ──N mini_test_answers
  ├── 1──1 credits
  ├── 1──N subscriptions
  ├── (parent) N── parent_links ──N (child)
  ├── (follower) N── follows ──N (following)
  └── 1──N shared_items → social_feed_view
```

#### Tables

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  grade TEXT,                          -- '중1'~'고3'
  school_type TEXT DEFAULT 'middle',   -- 'middle'|'high'
  role TEXT NOT NULL DEFAULT 'student', -- 'student'|'parent'
  plan TEXT NOT NULL DEFAULT 'free',    -- 'free'|'standard'|'premium'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_nickname ON public.users(nickname);

CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  image_urls TEXT[] NOT NULL,
  ocr_result JSONB,
  ocr_confidence REAL,
  status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded'|'processing'|'analyzed'|'error'
  error_message TEXT,
  question_count INT,
  credits_consumed INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);
CREATE INDEX idx_exams_user_id ON public.exams(user_id);
CREATE INDEX idx_exams_expires_at ON public.exams(expires_at);

CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  number INT NOT NULL,
  type TEXT NOT NULL,                   -- 'multiple_choice'|'short_answer'|'essay'
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  points INT,
  ocr_confidence REAL,
  user_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_questions_exam_id ON public.questions(exam_id);

CREATE TABLE public.blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL UNIQUE REFERENCES public.exams(id) ON DELETE CASCADE,
  unit_distribution JSONB NOT NULL,
  type_distribution JSONB NOT NULL,
  difficulty_distribution JSONB NOT NULL,
  insights TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.error_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL,             -- 'concept_gap'|'calculation_error'|'time_pressure'
  error_type_confidence REAL NOT NULL,
  reasoning TEXT NOT NULL,
  specific_mistake TEXT,
  correction_hint TEXT,
  solution_steps JSONB NOT NULL,
  verification_status TEXT DEFAULT 'pending', -- 'pending'|'verified'|'conflict'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.variant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES public.error_diagnoses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL,             -- 'easy'|'medium'|'hard'
  content TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  target_skill TEXT,
  trap_description TEXT,
  content_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_variants_diagnosis_id ON public.variant_questions(diagnosis_id);
CREATE INDEX idx_variants_content_hash ON public.variant_questions(content_hash);

CREATE TABLE public.mini_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  variant_ids UUID[] NOT NULL,
  total_questions INT NOT NULL,
  correct_count INT,
  score REAL,
  time_limit_seconds INT,
  time_spent_seconds INT,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress'|'completed'|'abandoned'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_mini_tests_user_id ON public.mini_tests(user_id);

CREATE TABLE public.mini_test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES public.mini_tests(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.variant_questions(id),
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  total INT NOT NULL DEFAULT 30,
  used INT NOT NULL DEFAULT 0,
  bonus INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,                   -- 'standard'|'premium'|'season_pass'|'parent'
  status TEXT NOT NULL DEFAULT 'active',
  payment_key TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

CREATE TABLE public.parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  link_code VARCHAR(6) UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'active'|'revoked'
  linked_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, child_user_id)
);

CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'accepted'|'blocked'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);
CREATE INDEX idx_follows_follower ON public.follows(follower_id) WHERE status = 'accepted';
CREATE INDEX idx_follows_following ON public.follows(following_id) WHERE status = 'accepted';

CREATE TABLE public.shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,              -- 'variant_set'|'error_note'|'mini_test_result'|'blueprint'
  item_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'followers_only',
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shared_items_user_id ON public.shared_items(user_id);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                   -- 'follow_request'|'shared_item'|'parent_link'|'test_complete'|'weekly_report'
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id) WHERE NOT is_read;

CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,            -- 'diagnosis'|'variant'|'explanation'
  target_id UUID NOT NULL,
  rating INT NOT NULL CHECK(rating IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE public.question_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL UNIQUE,
  classification JSONB,
  explanation JSONB,
  hit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW public.social_feed AS
SELECT si.id AS shared_item_id, si.user_id AS author_id,
  u.nickname AS author_nickname, u.avatar_url AS author_avatar,
  si.item_type, si.item_id, si.caption, si.created_at
FROM public.shared_items si JOIN public.users u ON si.user_id = u.id;
```

#### RLS Policies

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- exams: own only
CREATE POLICY "exams_all_own" ON public.exams FOR ALL USING (auth.uid() = user_id);

-- questions: via exam ownership
CREATE POLICY "questions_via_exam" ON public.questions FOR ALL
  USING (exam_id IN (SELECT id FROM public.exams WHERE user_id = auth.uid()));

-- blueprints: own + shared via follows
CREATE POLICY "blueprints_own" ON public.blueprints FOR ALL
  USING (exam_id IN (SELECT id FROM public.exams WHERE user_id = auth.uid()));
CREATE POLICY "blueprints_shared" ON public.blueprints FOR SELECT
  USING (id IN (
    SELECT item_id FROM public.shared_items si
    JOIN public.follows f ON si.user_id = f.following_id
    WHERE f.follower_id = auth.uid() AND f.status = 'accepted' AND si.item_type = 'blueprint'
  ));

-- parent_links: involved parties
CREATE POLICY "parent_links_involved" ON public.parent_links FOR ALL
  USING (auth.uid() IN (parent_user_id, child_user_id));

-- follows: involved parties
CREATE POLICY "follows_involved" ON public.follows FOR ALL
  USING (auth.uid() IN (follower_id, following_id));

-- shared_items: own + following feed
CREATE POLICY "shared_items_own" ON public.shared_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "shared_items_feed" ON public.shared_items FOR SELECT
  USING (user_id IN (
    SELECT following_id FROM public.follows WHERE follower_id = auth.uid() AND status = 'accepted'
  ));

-- notifications: own only
CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- Parent dashboard: server-side via service_role (bypasses RLS after parent_links check)
```

### 4.5 Infrastructure

| Setting | Value |
|---------|-------|
| Vercel region | `icn1` (Seoul) |
| Edge Functions | AI pipeline calls (bypass 10s limit) |
| Cron | `/api/cron/cleanup` daily 03:00 KST |
| Vercel Free → Pro | MAU 1,000+ ($20/mo) |
| Supabase Free → Pro | MAU 3,000+ ($25/mo) |
| Estimated infra (mo 12) | ~$550-850/mo |

---

## 5. Business Rules

### Pricing & Credits

| Plan | Price | Credits/mo | Features |
|------|-------|-----------|----------|
| Free | ₩0 | 30 questions | Blueprint, basic explanation, mobile solving |
| Standard | ₩9,900/mo | 150 | + error correction, variants, dashboard, social |
| Premium | ₩19,900/mo | 400 | + unlimited variants, score prediction |
| Season Pass | ₩6,900/2wk | 150 (14 days) | Standard features |
| Parent | ₩3,900/mo | N/A | Child dashboard, heatmap, weekly report |
| Extra | ₩100/question | Per purchase | When credits exhausted |

### Content Rules

- Original exam images: 7-day auto-delete (default), optional permanent retention
- Shareable content: AI-generated only (variants, error notes, blueprints). Original exams NEVER shareable
- Social: Follow approval required, max 200 followers, NO DM, NO text, content-only
- Parent: Aggregated data only, child-initiated linking, child-controlled revocation

---

## 6. Development Schedule

| Sprint | Weeks | Work | Hours |
|--------|-------|------|-------|
| 1-2 | 1-2 | Next.js + Supabase + Auth + exam upload + OCR pipeline + verify UI | ~24h |
| 3-4 | 3-4 | Blueprint + Claude explanation + GPT verification + error diagnosis + variant engine + result UI | ~28h |
| 5-6 | 5-6 | Mobile solver (MC/short/timer) + math keypad + KaTeX + grading + PWA | ~22h |
| 7 | 7 | Parent linking + dashboard + social (follow/share/feed) + notifications | ~20h |
| 8 | 8 | Credits + PortOne payment + 7-day cleanup + E2E QA + deploy | ~16h |

**Total: ~110h (8 weeks at 14h/week). Phase 0 prep: 40-55h separate.**
