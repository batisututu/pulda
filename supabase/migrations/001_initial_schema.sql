-- =============================================================================
-- StudyAI (시험의 신) — Consolidated Initial Database Schema
-- Target: Supabase PostgreSQL
-- Tables: 16 + 1 view + functions/triggers + RLS policies
-- NOTE: This migration is idempotent — safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        UNIQUE NOT NULL,
  nickname    TEXT        NOT NULL,
  grade       TEXT,       -- 'mid1','mid2','mid3','high1','high2','high3'
  school_type TEXT,       -- 'middle','high'
  role        TEXT        NOT NULL DEFAULT 'student'
                          CHECK (role IN ('student', 'parent')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users(email);

-- ---------------------------------------------------------------------------
-- 2. exams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT        NOT NULL DEFAULT 'math'
                           CHECK (subject IN ('math', 'korean', 'english', 'other')),
  service_tier TEXT        NOT NULL DEFAULT 'ai_analysis'
                           CHECK (service_tier IN ('ai_analysis', 'digitization')),
  image_url    TEXT,
  ocr_result   JSONB,
  status       TEXT        NOT NULL DEFAULT 'processing'
                           CHECK (status IN (
                             'processing','ocr_done','verified','analyzed','completed','error'
                           )),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_exams_user_id    ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_status     ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_expires_at ON exams(expires_at);

-- ---------------------------------------------------------------------------
-- 3. questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id        UUID        NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  subject        TEXT        NOT NULL DEFAULT 'math'
                             CHECK (subject IN ('math', 'korean', 'english', 'other')),
  number         INT         NOT NULL,
  content        TEXT        NOT NULL,
  question_type  TEXT        NOT NULL DEFAULT 'multiple_choice'
                             CHECK (question_type IN ('multiple_choice','short_answer','essay')),
  options        TEXT[],
  answer         TEXT,
  student_answer TEXT,
  is_correct     BOOLEAN,
  points         INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);

-- ---------------------------------------------------------------------------
-- 4. credits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credits (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan     TEXT NOT NULL DEFAULT 'free'
           CHECK (plan IN ('free','standard','premium','season_pass')),
  total    INT  NOT NULL DEFAULT 30,
  used     INT  NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

-- ---------------------------------------------------------------------------
-- 5. subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan                    TEXT        NOT NULL
                                      CHECK (plan IN ('free','standard','premium','season_pass','parent')),
  status                  TEXT        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active','cancelled','expired','pending')),
  portone_subscription_id TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- ---------------------------------------------------------------------------
-- 6. blueprints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blueprints (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id                  UUID        UNIQUE NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  unit_distribution        JSONB       NOT NULL,
  type_distribution        JSONB       NOT NULL,
  difficulty_distribution  JSONB       NOT NULL,
  insights                 TEXT[],
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. error_diagnoses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_diagnoses (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id         UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  error_type          TEXT        NOT NULL
                                  CHECK (error_type IN (
                                    'concept_gap','calculation_error','time_pressure',
                                    'comprehension_error','grammar_error','vocabulary_gap',
                                    'interpretation_error'
                                  )),
  confidence          FLOAT       NOT NULL DEFAULT 0.0
                                  CHECK (confidence >= 0 AND confidence <= 1),
  reasoning           TEXT        NOT NULL,
  correction          TEXT        NOT NULL,
  step_by_step        TEXT,
  verification_result JSONB,
  visual_explanation  JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_diagnoses_question_id ON error_diagnoses(question_id);

-- ---------------------------------------------------------------------------
-- 8. variant_questions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS variant_questions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id        UUID        REFERENCES error_diagnoses(id) ON DELETE SET NULL,
  content             TEXT        NOT NULL,
  question_type       TEXT        NOT NULL DEFAULT 'multiple_choice'
                                  CHECK (question_type IN ('multiple_choice','short_answer')),
  options             TEXT[],
  answer              TEXT        NOT NULL,
  explanation         TEXT        NOT NULL,
  difficulty          TEXT        NOT NULL DEFAULT 'medium'
                                  CHECK (difficulty IN ('easy','medium','hard')),
  target_error_type   TEXT,
  user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
  topic               TEXT,
  grade               TEXT,
  bloom_level         TEXT        CHECK (bloom_level IS NULL OR bloom_level IN (
                                    'knowledge','comprehension','application',
                                    'analysis','synthesis','evaluation'
                                  )),
  trap_point          TEXT,
  target_time_seconds INT,
  verification_result JSONB,
  visual_explanation  JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variant_questions_diagnosis_id ON variant_questions(diagnosis_id);
CREATE INDEX IF NOT EXISTS idx_variant_questions_user_id      ON variant_questions(user_id);

-- ---------------------------------------------------------------------------
-- 9. mini_tests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mini_tests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_ids  TEXT[]      NOT NULL,
  score        INT,
  total_points INT,
  time_spent   INT,           -- seconds
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_tests_user_id ON mini_tests(user_id);

-- ---------------------------------------------------------------------------
-- 10. mini_test_answers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mini_test_answers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id             UUID        NOT NULL REFERENCES mini_tests(id) ON DELETE CASCADE,
  variant_question_id UUID        NOT NULL REFERENCES variant_questions(id) ON DELETE CASCADE,
  user_answer         TEXT,
  is_correct          BOOLEAN,
  time_spent          INT,        -- seconds
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_test_answers_test_id ON mini_test_answers(test_id);

-- ---------------------------------------------------------------------------
-- 11. follows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','accepted','blocked')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- ---------------------------------------------------------------------------
-- 12. shared_items
-- ---------------------------------------------------------------------------
-- IMPORTANT: Original exam papers (item_type = 'exam') are NEVER shareable
-- (Rule 5: copyright protection). Only AI-generated outputs allowed.
CREATE TABLE IF NOT EXISTS shared_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type  TEXT        NOT NULL
                         CHECK (item_type IN ('variant_set','error_note','mini_test_result','blueprint')),
  item_id    UUID        NOT NULL,
  visibility TEXT        NOT NULL DEFAULT 'followers_only'
                         CHECK (visibility IN ('followers_only','public')),
  caption    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_items_user_id    ON shared_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_items_created_at ON shared_items(created_at DESC);

-- ---------------------------------------------------------------------------
-- 13. parent_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parent_links (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id  UUID         REFERENCES users(id) ON DELETE CASCADE,
  child_user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_code       VARCHAR(6)   UNIQUE,
  status          TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','active','revoked')),
  linked_at       TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(parent_user_id, child_user_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_child  ON parent_links(child_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_code   ON parent_links(link_code);

-- ---------------------------------------------------------------------------
-- 14. notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  body       TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  data       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read) WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- 15. feedbacks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedbacks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL
                          CHECK (target_type IN ('explanation','variant','blueprint')),
  target_id   UUID        NOT NULL,
  rating      INT         NOT NULL CHECK (rating IN (-1, 1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_target  ON feedbacks(target_type, target_id);

-- ---------------------------------------------------------------------------
-- 16. question_cache
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_cache (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash   TEXT        UNIQUE NOT NULL,
  classification JSONB,
  explanation    JSONB,
  hit_count      INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_cache_hash ON question_cache(content_hash);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- social_feed: denormalized view of shared items with user profile
CREATE OR REPLACE VIEW social_feed AS
SELECT
  si.id,
  si.user_id,
  u.nickname,
  u.avatar_url,
  si.item_type,
  si.item_id,
  si.caption,
  si.created_at,
  si.visibility
FROM shared_items si
JOIN users u ON u.id = si.user_id
ORDER BY si.created_at DESC;

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- get_user_id(): RLS helper mapping auth.uid() -> users.id
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $fn$
  SELECT id FROM users WHERE auth_id = auth.uid()
$fn$ LANGUAGE sql SECURITY DEFINER STABLE;

-- set_updated_at(): trigger function for updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_question_cache_updated_at ON question_cache;
CREATE TRIGGER trg_question_cache_updated_at
  BEFORE UPDATE ON question_cache
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- handle_new_user(): Auth trigger auto-creating users + credits rows
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $fn$
BEGIN
  INSERT INTO users (auth_id, email, nickname, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );

  IF COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'student' THEN
    INSERT INTO credits (user_id, plan, total, used)
    SELECT id, 'free', 30, 0 FROM users WHERE auth_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- increment_hit_count(): RPC function for question_cache
CREATE OR REPLACE FUNCTION increment_hit_count(cache_id UUID)
RETURNS void AS $fn$
BEGIN
  UPDATE question_cache
  SET hit_count = hit_count + 1,
      updated_at = now()
  WHERE id = cache_id;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_social_feed(): paginated social feed query
CREATE OR REPLACE FUNCTION get_social_feed(
  p_user_id UUID,
  p_limit   INT DEFAULT 20,
  p_offset  INT DEFAULT 0
)
RETURNS TABLE (
  id         UUID,
  user_id    UUID,
  item_type  TEXT,
  item_id    UUID,
  visibility TEXT,
  caption    TEXT,
  created_at TIMESTAMPTZ,
  nickname   TEXT,
  avatar_url TEXT
) AS $fn$
BEGIN
  RETURN QUERY
  SELECT
    sf.id, sf.user_id, sf.item_type, sf.item_id,
    sf.visibility, sf.caption, sf.created_at,
    sf.nickname, sf.avatar_url
  FROM social_feed sf
  WHERE
    sf.user_id = p_user_id
    OR sf.visibility = 'public'
    OR (
      sf.visibility = 'followers_only'
      AND sf.user_id IN (
        SELECT f.following_id FROM follows f
        WHERE f.follower_id = p_user_id AND f.status = 'accepted'
      )
    )
  ORDER BY sf.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;

-- cleanup_expired_exams(): scheduled deletion
CREATE OR REPLACE FUNCTION cleanup_expired_exams()
RETURNS void AS $fn$
BEGIN
  DELETE FROM exams WHERE expires_at < now() AND expires_at IS NOT NULL;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: pg_cron schedule (enable in Supabase dashboard first):
-- SELECT cron.schedule('cleanup-expired-exams', '0 18 * * *', 'SELECT cleanup_expired_exams()');

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all 16 tables
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_diagnoses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_tests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_cache    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users: any authenticated user can read profiles (social); own row for write
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_select_authenticated" ON users;
CREATE POLICY "users_select_authenticated" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- ---------------------------------------------------------------------------
-- exams: owner only (via get_user_id())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "exams_select_own" ON exams;
CREATE POLICY "exams_select_own" ON exams
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "exams_insert_own" ON exams;
CREATE POLICY "exams_insert_own" ON exams
  FOR INSERT WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "exams_update_own" ON exams;
CREATE POLICY "exams_update_own" ON exams
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "exams_delete_own" ON exams;
CREATE POLICY "exams_delete_own" ON exams
  FOR DELETE USING (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- questions: via exam ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "questions_select_own" ON questions;
CREATE POLICY "questions_select_own" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
        AND exams.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "questions_insert_own" ON questions;
CREATE POLICY "questions_insert_own" ON questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
        AND exams.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "questions_update_own" ON questions;
CREATE POLICY "questions_update_own" ON questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
        AND exams.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "questions_delete_own" ON questions;
CREATE POLICY "questions_delete_own" ON questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = questions.exam_id
        AND exams.user_id = get_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- credits: own row only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "credits_select_own" ON credits;
CREATE POLICY "credits_select_own" ON credits
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "credits_update_own" ON credits;
CREATE POLICY "credits_update_own" ON credits
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- subscriptions: own rows only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions;
CREATE POLICY "subscriptions_insert_own" ON subscriptions
  FOR INSERT WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions;
CREATE POLICY "subscriptions_update_own" ON subscriptions
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- blueprints: via exam ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "blueprints_select_own" ON blueprints;
CREATE POLICY "blueprints_select_own" ON blueprints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = blueprints.exam_id
        AND exams.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "blueprints_insert_own" ON blueprints;
CREATE POLICY "blueprints_insert_own" ON blueprints
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exams
      WHERE exams.id = blueprints.exam_id
        AND exams.user_id = get_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- error_diagnoses: via question -> exam ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "error_diagnoses_select_own" ON error_diagnoses;
CREATE POLICY "error_diagnoses_select_own" ON error_diagnoses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE q.id = error_diagnoses.question_id
        AND e.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "error_diagnoses_insert_own" ON error_diagnoses;
CREATE POLICY "error_diagnoses_insert_own" ON error_diagnoses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE q.id = error_diagnoses.question_id
        AND e.user_id = get_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- variant_questions: via diagnosis chain OR direct user_id ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "variant_questions_select_own" ON variant_questions;
CREATE POLICY "variant_questions_select_own" ON variant_questions
  FOR SELECT USING (
    user_id = get_user_id()
    OR EXISTS (
      SELECT 1 FROM error_diagnoses d
      JOIN questions q ON q.id = d.question_id
      JOIN exams e ON e.id = q.exam_id
      WHERE d.id = variant_questions.diagnosis_id
        AND e.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "variant_questions_insert_own" ON variant_questions;
CREATE POLICY "variant_questions_insert_own" ON variant_questions
  FOR INSERT WITH CHECK (
    user_id = get_user_id()
    OR EXISTS (
      SELECT 1 FROM error_diagnoses d
      JOIN questions q ON q.id = d.question_id
      JOIN exams e ON e.id = q.exam_id
      WHERE d.id = variant_questions.diagnosis_id
        AND e.user_id = get_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- mini_tests: own rows only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "mini_tests_select_own" ON mini_tests;
CREATE POLICY "mini_tests_select_own" ON mini_tests
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "mini_tests_insert_own" ON mini_tests;
CREATE POLICY "mini_tests_insert_own" ON mini_tests
  FOR INSERT WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "mini_tests_update_own" ON mini_tests;
CREATE POLICY "mini_tests_update_own" ON mini_tests
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- mini_test_answers: via mini_test ownership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "mini_test_answers_select_own" ON mini_test_answers;
CREATE POLICY "mini_test_answers_select_own" ON mini_test_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM mini_tests
      WHERE mini_tests.id = mini_test_answers.test_id
        AND mini_tests.user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "mini_test_answers_insert_own" ON mini_test_answers;
CREATE POLICY "mini_test_answers_insert_own" ON mini_test_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM mini_tests
      WHERE mini_tests.id = mini_test_answers.test_id
        AND mini_tests.user_id = get_user_id()
    )
  );

-- ---------------------------------------------------------------------------
-- follows: both parties can read; follower manages the follow
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "follows_select_own" ON follows;
CREATE POLICY "follows_select_own" ON follows
  FOR SELECT USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own" ON follows
  FOR INSERT WITH CHECK (follower_id = get_user_id());

DROP POLICY IF EXISTS "follows_update_own" ON follows;
CREATE POLICY "follows_update_own" ON follows
  FOR UPDATE USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own" ON follows
  FOR DELETE USING (follower_id = get_user_id());

-- ---------------------------------------------------------------------------
-- shared_items: owner CRUD + public readable + followers-only by accepted follows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "shared_items_select_own" ON shared_items;
CREATE POLICY "shared_items_select_own" ON shared_items
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "shared_items_select_public" ON shared_items;
CREATE POLICY "shared_items_select_public" ON shared_items
  FOR SELECT USING (visibility = 'public' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "shared_items_select_followers" ON shared_items;
CREATE POLICY "shared_items_select_followers" ON shared_items
  FOR SELECT USING (
    visibility = 'followers_only'
    AND EXISTS (
      SELECT 1 FROM follows
      WHERE follows.following_id = shared_items.user_id
        AND follows.follower_id = get_user_id()
        AND follows.status = 'accepted'
    )
  );

DROP POLICY IF EXISTS "shared_items_insert_own" ON shared_items;
CREATE POLICY "shared_items_insert_own" ON shared_items
  FOR INSERT WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "shared_items_update_own" ON shared_items;
CREATE POLICY "shared_items_update_own" ON shared_items
  FOR UPDATE USING (user_id = get_user_id());

DROP POLICY IF EXISTS "shared_items_delete_own" ON shared_items;
CREATE POLICY "shared_items_delete_own" ON shared_items
  FOR DELETE USING (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- parent_links: parent or child can read/update; child creates
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "parent_links_select_own" ON parent_links;
CREATE POLICY "parent_links_select_own" ON parent_links
  FOR SELECT USING (
    parent_user_id = get_user_id() OR child_user_id = get_user_id()
  );

DROP POLICY IF EXISTS "parent_links_insert_child" ON parent_links;
CREATE POLICY "parent_links_insert_child" ON parent_links
  FOR INSERT WITH CHECK (
    child_user_id = get_user_id()
    AND (parent_user_id IS NULL OR parent_user_id = get_user_id())
  );

DROP POLICY IF EXISTS "parent_links_update_own" ON parent_links;
CREATE POLICY "parent_links_update_own" ON parent_links
  FOR UPDATE USING (
    parent_user_id = get_user_id() OR child_user_id = get_user_id()
  );

-- ---------------------------------------------------------------------------
-- notifications: own rows only (service role handles INSERT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- feedbacks: own rows only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "feedbacks_select_own" ON feedbacks;
CREATE POLICY "feedbacks_select_own" ON feedbacks
  FOR SELECT USING (user_id = get_user_id());

DROP POLICY IF EXISTS "feedbacks_insert_own" ON feedbacks;
CREATE POLICY "feedbacks_insert_own" ON feedbacks
  FOR INSERT WITH CHECK (user_id = get_user_id());

DROP POLICY IF EXISTS "feedbacks_update_own" ON feedbacks;
CREATE POLICY "feedbacks_update_own" ON feedbacks
  FOR UPDATE USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- ---------------------------------------------------------------------------
-- question_cache: no user-facing RLS policies
-- Accessed only via SECURITY DEFINER functions and service_role key.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
