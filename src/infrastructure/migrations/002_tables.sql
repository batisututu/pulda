-- 002_tables.sql
-- Sprint 1-2 Wave 1: Core tables for exam upload + AI pipeline + credits + cache + feedback

-- ============================================================
-- 1. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. exams
-- ============================================================
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT,
  ocr_result JSONB,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing','ocr_done','verified','analyzed','completed','error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_expires_at ON exams(expires_at);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. questions
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
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

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. credits
-- ============================================================
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','standard','premium','season_pass','parent')),
  total INT NOT NULL DEFAULT 30,
  used INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. question_cache
-- ============================================================
CREATE TABLE IF NOT EXISTS question_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT UNIQUE NOT NULL,
  classification JSONB,
  explanation JSONB,
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_cache_hash ON question_cache(content_hash);

ALTER TABLE question_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. feedbacks
-- ============================================================
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('explanation','variant','blueprint')),
  target_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_target ON feedbacks(target_type, target_id);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
