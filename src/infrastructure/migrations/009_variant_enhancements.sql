-- 009_variant_enhancements.sql
-- Adds bloom_level, trap_point, target_time_seconds to variant_questions.

ALTER TABLE variant_questions
  ADD COLUMN IF NOT EXISTS bloom_level TEXT,
  ADD COLUMN IF NOT EXISTS trap_point TEXT,
  ADD COLUMN IF NOT EXISTS target_time_seconds INT;

CREATE INDEX IF NOT EXISTS idx_variant_questions_bloom_level ON variant_questions(bloom_level);
