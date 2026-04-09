-- 008_topic_generation.sql
-- Extends variant_questions to support independent topic-based generation (no exam/diagnosis required).

-- variant_questions 확장: 독립 생성 지원
ALTER TABLE variant_questions
  ALTER COLUMN diagnosis_id DROP NOT NULL;

ALTER TABLE variant_questions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS grade TEXT;

CREATE INDEX IF NOT EXISTS idx_variant_questions_user_id ON variant_questions(user_id);

-- RLS: 독립 생성 문제는 user_id로 접근 제어
CREATE POLICY "Users can view own topic variants" ON variant_questions
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert own topic variants" ON variant_questions
  FOR INSERT WITH CHECK (user_id = get_user_id());
