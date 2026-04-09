-- 006_wave2_tables.sql
-- Sprint 3-4 Wave 2: Tables for L2 classification, L3 diagnosis, L4 variant generation

-- ============================================================
-- 1. blueprints
-- ============================================================
CREATE TABLE IF NOT EXISTS blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID UNIQUE NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  unit_distribution JSONB NOT NULL,
  type_distribution JSONB NOT NULL,
  difficulty_distribution JSONB NOT NULL,
  insights JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_exam_id ON blueprints(exam_id);

ALTER TABLE blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blueprints" ON blueprints
  FOR SELECT USING (
    exam_id IN (SELECT id FROM exams WHERE user_id = get_user_id())
  );

-- ============================================================
-- 2. error_diagnoses
-- ============================================================
CREATE TABLE IF NOT EXISTS error_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  error_type TEXT NOT NULL CHECK (error_type IN ('concept_gap','calculation_error','time_pressure')),
  confidence FLOAT NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT NOT NULL,
  correction TEXT NOT NULL,
  step_by_step TEXT,
  verification_result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_diagnoses_question_id ON error_diagnoses(question_id);

ALTER TABLE error_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own error diagnoses" ON error_diagnoses
  FOR SELECT USING (
    question_id IN (
      SELECT q.id FROM questions q
      JOIN exams e ON e.id = q.exam_id
      WHERE e.user_id = get_user_id()
    )
  );

-- ============================================================
-- 3. variant_questions
-- ============================================================
CREATE TABLE IF NOT EXISTS variant_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id UUID NOT NULL REFERENCES error_diagnoses(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice','short_answer')),
  options JSONB,
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',
  target_error_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variant_questions_diagnosis_id ON variant_questions(diagnosis_id);

ALTER TABLE variant_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own variant questions" ON variant_questions
  FOR SELECT USING (
    diagnosis_id IN (
      SELECT ed.id FROM error_diagnoses ed
      JOIN questions q ON q.id = ed.question_id
      JOIN exams e ON e.id = q.exam_id
      WHERE e.user_id = get_user_id()
    )
  );
