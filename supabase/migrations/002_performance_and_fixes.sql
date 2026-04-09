-- =============================================================================
-- StudyAI (시험의 신) — Performance & Quality Improvements
-- Migration 002: Atomic RPCs, schema fixes, cache TTL
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Atomic credit deduction RPC
-- 크레딧 차감 시 동시성 문제 방지를 위한 원자적 함수
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount INT)
RETURNS TABLE (
  id       UUID,
  user_id  UUID,
  plan     TEXT,
  total    INT,
  used     INT,
  reset_at TIMESTAMPTZ
) AS $$
  UPDATE credits
  SET used = used + p_amount
  WHERE credits.user_id = p_user_id
    AND total - (used + p_amount) >= 0
  RETURNING credits.id, credits.user_id, credits.plan, credits.total, credits.used, credits.reset_at;
$$ LANGUAGE sql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. Schema fixes
-- ---------------------------------------------------------------------------

-- 2a. parent_links: active 상태에서 parent_user_id NOT NULL 보장
ALTER TABLE parent_links DROP CONSTRAINT IF EXISTS chk_active_parent_user_id;
ALTER TABLE parent_links ADD CONSTRAINT chk_active_parent_user_id
  CHECK (status != 'active' OR parent_user_id IS NOT NULL);

-- 2b. question_cache에 TTL 컬럼 추가
ALTER TABLE question_cache
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '90 days';

CREATE INDEX IF NOT EXISTS idx_question_cache_expires_at
  ON question_cache(expires_at);

-- 2c. 만료된 캐시 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $fn$
BEGIN
  DELETE FROM question_cache WHERE expires_at < now() AND expires_at IS NOT NULL;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: pg_cron 스케줄 (Supabase 대시보드에서 pg_cron 활성화 후 실행):
-- SELECT cron.schedule('cleanup-expired-cache', '0 3 * * *', 'SELECT cleanup_expired_cache()');
-- SELECT cron.schedule('cleanup-expired-exams', '0 18 * * *', 'SELECT cleanup_expired_exams()');

-- ---------------------------------------------------------------------------
-- 3. JSONB 컬럼 구조 체크 제약 조건
-- ---------------------------------------------------------------------------
ALTER TABLE exams DROP CONSTRAINT IF EXISTS chk_ocr_result_jsonb;
ALTER TABLE exams ADD CONSTRAINT chk_ocr_result_jsonb
  CHECK (ocr_result IS NULL OR jsonb_typeof(ocr_result) = 'object');

ALTER TABLE question_cache DROP CONSTRAINT IF EXISTS chk_classification_jsonb;
ALTER TABLE question_cache ADD CONSTRAINT chk_classification_jsonb
  CHECK (classification IS NULL OR jsonb_typeof(classification) = 'object');

ALTER TABLE question_cache DROP CONSTRAINT IF EXISTS chk_explanation_jsonb;
ALTER TABLE question_cache ADD CONSTRAINT chk_explanation_jsonb
  CHECK (explanation IS NULL OR jsonb_typeof(explanation) = 'object');

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_data_jsonb;
ALTER TABLE notifications ADD CONSTRAINT chk_notification_data_jsonb
  CHECK (data IS NULL OR jsonb_typeof(data) = 'object');
