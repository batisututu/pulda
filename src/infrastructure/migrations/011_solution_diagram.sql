-- Add solution_diagram column to error_diagnoses table
-- Stores the visual flow-chart representation of a solution as JSON
-- Nullable for backward compatibility with existing diagnoses

ALTER TABLE error_diagnoses
  ADD COLUMN IF NOT EXISTS solution_diagram jsonb DEFAULT NULL;

COMMENT ON COLUMN error_diagnoses.solution_diagram IS
  'Visual flow-chart JSON (nodes, edges, errorNodeId, summary, conceptKeywords). NULL if not generated.';
