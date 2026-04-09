-- Rename solution_diagram to visual_explanation in error_diagnoses
-- The visual_explanation column stores a discriminated union JSON:
-- { "type": "flow"|"comparison"|"formula", "data": { ... } }

ALTER TABLE error_diagnoses
  RENAME COLUMN solution_diagram TO visual_explanation;

-- Add visual_explanation to variant_questions for L4 variant explanations
ALTER TABLE variant_questions
  ADD COLUMN IF NOT EXISTS visual_explanation jsonb DEFAULT NULL;

COMMENT ON COLUMN error_diagnoses.visual_explanation IS
  'Visual explanation JSON: { type: "flow"|"comparison"|"formula", data: {...} }. NULL if generation failed.';

COMMENT ON COLUMN variant_questions.visual_explanation IS
  'Visual explanation JSON for variant question solution. Same structure as error_diagnoses.visual_explanation.';
