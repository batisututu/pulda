# Complete RLS Policies for All Tables

## Enable RLS on All Tables

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
```

## Helper: Get user ID from auth

```sql
-- auth.uid() returns the authenticated user's auth ID
-- We need to map to our users table ID
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

## users

```sql
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth_id = auth.uid());

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth_id = auth.uid());

-- Public profiles for social features (nickname, avatar only via API)
CREATE POLICY "Authenticated users can view public profiles" ON users
  FOR SELECT USING (auth.role() = 'authenticated');
```

## exams

```sql
CREATE POLICY "Users can view own exams" ON exams
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert own exams" ON exams
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own exams" ON exams
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Users can delete own exams" ON exams
  FOR DELETE USING (user_id = get_user_id());
```

## questions

```sql
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
```

## blueprints

```sql
CREATE POLICY "Users can view own blueprints" ON blueprints
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );

CREATE POLICY "Users can insert own blueprints" ON blueprints
  FOR INSERT WITH CHECK (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );
```

## error_diagnoses

```sql
CREATE POLICY "Users can view own diagnoses" ON error_diagnoses
  FOR SELECT USING (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE e.user_id = get_user_id()
    )
  );

CREATE POLICY "Users can insert own diagnoses" ON error_diagnoses
  FOR INSERT WITH CHECK (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE e.user_id = get_user_id()
    )
  );
```

## variant_questions

```sql
CREATE POLICY "Users can view own variants" ON variant_questions
  FOR SELECT USING (
    diagnosis_id IN (
      SELECT ed.id FROM error_diagnoses ed
      JOIN questions q ON q.id = ed.question_id
      JOIN exams e ON e.id = q.exam_id
      WHERE e.user_id = get_user_id()
    )
  );

-- Also allow viewing shared variants via shared_items
CREATE POLICY "Users can view shared variants" ON variant_questions
  FOR SELECT USING (
    id IN (
      SELECT unnest(
        (SELECT variant_ids FROM mini_tests mt
         JOIN shared_items si ON si.item_id = mt.id
         WHERE si.item_type = 'variant_set'
         AND (
           si.user_id = get_user_id() OR
           si.visibility = 'public' OR
           EXISTS (
             SELECT 1 FROM follows
             WHERE follower_id = get_user_id()
             AND following_id = si.user_id
             AND status = 'accepted'
           )
         ))
      )
    )
  );
```

## mini_tests

```sql
CREATE POLICY "Users can view own tests" ON mini_tests
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert own tests" ON mini_tests
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own tests" ON mini_tests
  FOR UPDATE USING (user_id = get_user_id());
```

## mini_test_answers

```sql
CREATE POLICY "Users can view own answers" ON mini_test_answers
  FOR SELECT USING (
    test_id IN (SELECT id FROM mini_tests WHERE user_id = get_user_id())
  );

CREATE POLICY "Users can insert own answers" ON mini_test_answers
  FOR INSERT WITH CHECK (
    test_id IN (SELECT id FROM mini_tests WHERE user_id = get_user_id())
  );
```

## credits

```sql
CREATE POLICY "Users can view own credits" ON credits
  FOR SELECT USING (user_id = get_user_id());

-- Credits are managed by service role (API routes) only
-- No direct user INSERT/UPDATE/DELETE policies
```

## subscriptions

```sql
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (user_id = get_user_id());

-- Subscriptions managed by service role (webhook/API) only
```

## question_cache

```sql
-- Service-role only, no user-facing policies
-- Accessed only via API routes with SUPABASE_SERVICE_ROLE_KEY
```

## feedbacks

```sql
CREATE POLICY "Users can view own feedbacks" ON feedbacks
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Users can insert feedbacks" ON feedbacks
  FOR INSERT WITH CHECK (user_id = get_user_id());

CREATE POLICY "Users can update own feedbacks" ON feedbacks
  FOR UPDATE USING (user_id = get_user_id());
```

## parent_links

```sql
-- Both parent and child can see their links
CREATE POLICY "Users see own parent links" ON parent_links
  FOR SELECT USING (
    parent_user_id = get_user_id() OR child_user_id = get_user_id()
  );

-- Only children can create link codes
CREATE POLICY "Children create links" ON parent_links
  FOR INSERT WITH CHECK (child_user_id = get_user_id());

-- Children can revoke; parents can update status
CREATE POLICY "Users manage parent links" ON parent_links
  FOR UPDATE USING (
    child_user_id = get_user_id() OR parent_user_id = get_user_id()
  );
```

## follows

```sql
-- Users see follows they're part of
CREATE POLICY "Users see own follows" ON follows
  FOR SELECT USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );

-- Users can request to follow others
CREATE POLICY "Users can follow" ON follows
  FOR INSERT WITH CHECK (follower_id = get_user_id());

-- Target can accept/reject; either party can block
CREATE POLICY "Users manage follows" ON follows
  FOR UPDATE USING (
    following_id = get_user_id() OR follower_id = get_user_id()
  );

-- Either party can unfollow/remove
CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (
    follower_id = get_user_id() OR following_id = get_user_id()
  );
```

## shared_items

```sql
-- Owner sees own shares
CREATE POLICY "Owner sees own shares" ON shared_items
  FOR SELECT USING (user_id = get_user_id());

-- Followers see shares from accepted follows
CREATE POLICY "Followers see shared items" ON shared_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM follows
      WHERE follows.follower_id = get_user_id()
        AND follows.following_id = shared_items.user_id
        AND follows.status = 'accepted'
    )
  );

-- Public items visible to all authenticated
CREATE POLICY "Public items visible" ON shared_items
  FOR SELECT USING (visibility = 'public');

-- Users can share own content
CREATE POLICY "Users can share" ON shared_items
  FOR INSERT WITH CHECK (user_id = get_user_id());

-- Users can manage own shares
CREATE POLICY "Users manage own shares" ON shared_items
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Users delete own shares" ON shared_items
  FOR DELETE USING (user_id = get_user_id());
```

## notifications

```sql
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (user_id = get_user_id());

-- Notifications created by service role only (triggers/API)

CREATE POLICY "Users mark own notifications read" ON notifications
  FOR UPDATE USING (user_id = get_user_id());
```

## Supabase Storage Policies (exam-images bucket)

```sql
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
```