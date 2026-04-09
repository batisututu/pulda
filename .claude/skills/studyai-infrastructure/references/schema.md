# Complete Database Schema

All tables use UUID primary keys (`gen_random_uuid()`). Timestamps default to `now()`. Target: Supabase PostgreSQL.

## Core Tables

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  grade TEXT, -- 'mid1','mid2','mid3','high1','high2','high3'
  school_type TEXT, -- 'middle','high'
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'parent')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### exams

```sql
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,
  ocr_result JSONB,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing','ocr_done','verified','analyzed','completed','error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);
```

### questions

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  number INT NOT NULL,
  content TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','short_answer','essay')),
  options JSONB,
  answer TEXT,
  student_answer TEXT,
  is_correct BOOLEAN,
  points INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### blueprints

```sql
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID UNIQUE NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  unit_distribution JSONB NOT NULL,
  type_distribution JSONB NOT NULL,
  difficulty_distribution JSONB NOT NULL,
  insights JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### error_diagnoses

```sql
CREATE TABLE error_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL CHECK (error_type IN ('concept_gap','calculation_error','time_pressure')),
  confidence FLOAT NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT NOT NULL,
  correction TEXT NOT NULL,
  step_by_step TEXT,
  verification_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### variant_questions

```sql
CREATE TABLE variant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES error_diagnoses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','short_answer')),
  options JSONB,
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  target_error_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### mini_tests

```sql
CREATE TABLE mini_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_ids UUID[] NOT NULL,
  score INT,
  total_points INT,
  time_spent INT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### mini_test_answers

```sql
CREATE TABLE mini_test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES mini_tests(id) ON DELETE CASCADE,
  variant_question_id UUID NOT NULL REFERENCES variant_questions(id),
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Payment Tables

### credits

```sql
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','standard','premium','season_pass')),
  total INT NOT NULL DEFAULT 30,
  used INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);
```

### subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','standard','premium','season_pass','parent')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','pending')),
  portone_subscription_id TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Cache & Feedback Tables

### question_cache

```sql
CREATE TABLE question_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT UNIQUE NOT NULL,
  classification JSONB,
  explanation JSONB,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### feedbacks

```sql
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('explanation','variant','blueprint')),
  target_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);
```

## Social Tables

### parent_links

```sql
CREATE TABLE parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_code VARCHAR(6) UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  linked_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(parent_user_id, child_user_id)
);
```

### follows

```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);
```

### shared_items

```sql
CREATE TABLE shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('variant_set','error_note','mini_test_result','blueprint')),
  item_id UUID NOT NULL,
  visibility TEXT DEFAULT 'followers_only' CHECK (visibility IN ('followers_only','public')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- IMPORTANT: Original exam papers are NEVER shareable (copyright protection)
```

### notifications

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
```

## Views

### social_feed

```sql
CREATE VIEW social_feed AS
SELECT si.id, si.user_id, u.nickname, u.avatar_url,
  si.item_type, si.item_id, si.caption, si.created_at, si.visibility
FROM shared_items si JOIN users u ON u.id = si.user_id
ORDER BY si.created_at DESC;
```

## Functions & Scheduled Jobs

### cleanup_expired_exams

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_exams()
RETURNS void AS $$
BEGIN
  DELETE FROM exams WHERE expires_at < now() AND expires_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule daily at 3 AM KST (18:00 UTC) via pg_cron
SELECT cron.schedule('cleanup-expired-exams', '0 18 * * *', 'SELECT cleanup_expired_exams()');
```

### handle_new_user (Auth Trigger)

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

### get_user_id (RLS Helper)

```sql
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```
