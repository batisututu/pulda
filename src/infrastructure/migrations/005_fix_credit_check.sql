-- 005_fix_credit_check.sql
-- Add 'parent' to the credits plan CHECK constraint

ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_plan_check;
ALTER TABLE credits ADD CONSTRAINT credits_plan_check CHECK (plan IN ('free', 'standard', 'premium', 'season_pass', 'parent'));
