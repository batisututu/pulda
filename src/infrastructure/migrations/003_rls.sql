-- 003_rls.sql
-- RLS policies for Sprint 1-2 Wave 1 tables + Storage bucket

-- ============================================================
-- users policies
-- ============================================================
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "Authenticated users can view public profiles" ON users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- exams policies
-- ============================================================
CREATE POLICY "Users can view own exams" ON exams
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert own exams" ON exams
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own exams" ON exams
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Users can delete own exams" ON exams
  FOR DELETE USING (user_id = get_user_id());

-- ============================================================
-- questions policies
-- ============================================================
CREATE POLICY "Users can view own questions" ON questions
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );

CREATE POLICY "Users can insert own questions" ON questions
  FOR INSERT WITH CHECK (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );

CREATE POLICY "Users can update own questions" ON questions
  FOR UPDATE USING (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );

-- ============================================================
-- credits policies
-- ============================================================
CREATE POLICY "Users can view own credits" ON credits
  FOR SELECT USING (user_id = get_user_id());

-- Credits are managed by service role (API routes) only
-- No direct user INSERT/UPDATE/DELETE policies

-- ============================================================
-- question_cache policies
-- ============================================================
-- Service-role only, no user-facing policies
-- Accessed only via API routes with SUPABASE_SERVICE_ROLE_KEY

-- ============================================================
-- feedbacks policies
-- ============================================================
CREATE POLICY "Users can view own feedbacks" ON feedbacks
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own feedbacks" ON feedbacks
  FOR UPDATE USING (user_id = get_user_id());

-- ============================================================
-- Storage: exam-images bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-images', 'exam-images', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users upload own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exam-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own images
CREATE POLICY "Users view own images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own images
CREATE POLICY "Users delete own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exam-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
