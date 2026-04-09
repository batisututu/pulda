-- 010_variant_verification.sql
-- Adds verification_result JSONB column to store self-verification results.

ALTER TABLE variant_questions
  ADD COLUMN IF NOT EXISTS verification_result JSONB;
