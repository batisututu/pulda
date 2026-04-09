-- 007_wave3_tables.sql
-- Sprint 5-6 Wave 3: MiniTest, Social, Parent, Notifications, Subscriptions

-- ============================================================
-- 1. mini_tests
-- ============================================================
CREATE TABLE IF NOT EXISTS mini_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_ids UUID[] NOT NULL,
  score INT,
  total_points INT,
  time_spent INT,                -- seconds
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_tests_user_id ON mini_tests(user_id);

ALTER TABLE mini_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mini tests" ON mini_tests
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert own mini tests" ON mini_tests
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own mini tests" ON mini_tests
  FOR UPDATE USING (user_id = get_user_id());

-- ============================================================
-- 2. mini_test_answers
-- ============================================================
CREATE TABLE IF NOT EXISTS mini_test_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL REFERENCES mini_tests(id) ON DELETE CASCADE,
  variant_question_id UUID NOT NULL REFERENCES variant_questions(id) ON DELETE CASCADE,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent INT,                -- seconds
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mini_test_answers_test_id ON mini_test_answers(test_id);

ALTER TABLE mini_test_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mini test answers" ON mini_test_answers
  FOR SELECT USING (
    test_id IN (SELECT id FROM mini_tests WHERE user_id = get_user_id())
  );

CREATE POLICY "Users can insert own mini test answers" ON mini_test_answers
  FOR INSERT WITH CHECK (
    test_id IN (SELECT id FROM mini_tests WHERE user_id = get_user_id())
  );

-- ============================================================
-- 3. subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','standard','premium','season_pass','parent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','pending')),
  portone_subscription_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = get_user_id());

-- ============================================================
-- 4. parent_links
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  link_code TEXT,                 -- 6-char alphanumeric
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  linked_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_child ON parent_links(child_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_code ON parent_links(link_code);

ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parent links" ON parent_links
  FOR SELECT USING (
    parent_user_id = get_user_id() OR child_user_id = get_user_id()
  );

CREATE POLICY "Children can create parent links" ON parent_links
  FOR INSERT WITH CHECK (
    child_user_id = get_user_id()
    AND (parent_user_id IS NULL OR parent_user_id = get_user_id())
  );

CREATE POLICY "Both parties can update parent links" ON parent_links
  FOR UPDATE USING (
    parent_user_id = get_user_id() OR child_user_id = get_user_id()
  );

-- ============================================================
-- 5. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = get_user_id());

-- Service role handles INSERT (no user INSERT policy)

-- ============================================================
-- 6. follows
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own follows" ON follows
  FOR SELECT USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

CREATE POLICY "Users can insert as follower" ON follows
  FOR INSERT WITH CHECK (follower_id = get_user_id());

CREATE POLICY "Both parties can update follows" ON follows
  FOR UPDATE USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

CREATE POLICY "Both parties can delete follows" ON follows
  FOR DELETE USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

-- ============================================================
-- 7. shared_items
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('variant_set','error_note','mini_test_result','blueprint')),
  item_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'followers_only' CHECK (visibility IN ('followers_only','public')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_items_user_id ON shared_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_items_created_at ON shared_items(created_at DESC);

ALTER TABLE shared_items ENABLE ROW LEVEL SECURITY;

-- Owner can always see own items
CREATE POLICY "Owner can view own shared items" ON shared_items
  FOR SELECT USING (user_id = get_user_id());

-- Followers can see followers_only items from accepted follows
CREATE POLICY "Followers can view followed shared items" ON shared_items
  FOR SELECT USING (
    visibility = 'followers_only' AND
    user_id IN (
      SELECT following_id FROM follows
      WHERE follower_id = get_user_id() AND status = 'accepted'
    )
  );

-- Anyone authenticated can see public items
CREATE POLICY "Authenticated users can view public shared items" ON shared_items
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "Users can insert own shared items" ON shared_items
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own shared items" ON shared_items
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Users can delete own shared items" ON shared_items
  FOR DELETE USING (user_id = get_user_id());

-- ============================================================
-- 8. social_feed view
-- ============================================================
CREATE OR REPLACE VIEW social_feed AS
SELECT
  si.id,
  si.user_id,
  si.item_type,
  si.item_id,
  si.visibility,
  si.caption,
  si.created_at,
  u.nickname,
  u.avatar_url
FROM shared_items si
JOIN users u ON u.id = si.user_id;

-- ============================================================
-- 9. get_social_feed function
-- ============================================================
CREATE OR REPLACE FUNCTION get_social_feed(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  item_type TEXT,
  item_id UUID,
  visibility TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ,
  nickname TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sf.id,
    sf.user_id,
    sf.item_type,
    sf.item_id,
    sf.visibility,
    sf.caption,
    sf.created_at,
    sf.nickname,
    sf.avatar_url
  FROM social_feed sf
  WHERE
    -- Own items
    sf.user_id = p_user_id
    OR
    -- Public items
    sf.visibility = 'public'
    OR
    -- Followers-only items from accepted follows
    (
      sf.visibility = 'followers_only' AND
      sf.user_id IN (
        SELECT f.following_id FROM follows f
        WHERE f.follower_id = p_user_id AND f.status = 'accepted'
      )
    )
  ORDER BY sf.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public;
