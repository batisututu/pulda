-- 001_functions.sql
-- RLS helper function: maps auth.uid() to public.users.id

CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;
