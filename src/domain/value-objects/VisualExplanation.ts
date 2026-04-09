/**
 * Visual Explanation types — the core differentiator of 풀다 (StudyAI).
 *
 * All explanations are presented as visual diagrams first, text second.
 * Three diagram types cover different problem-solving patterns:
 *
 * - flow:       Multi-step procedure (equations, inequalities)
 * - comparison: Student vs correct solution side-by-side
 * - formula:    Line-by-line formula breakdown with annotations
 */

// ─────────────────────────────────────────────
// Type 1: SolutionFlow — step-by-step flow chart
// ─────────────────────────────────────────────

export type FlowNodeType = 'step' | 'branch' | 'error_point' | 'result';
export type FlowNodeStatus = 'correct' | 'error' | 'neutral';

export interface FlowNode {
  id: string;                    // e.g. "n1", "n2"
  type: FlowNodeType;
  label: string;                 // <=15 chars Korean summary
  latex: string | null;          // key formula
  status: FlowNodeStatus;
}

export interface FlowEdge {
  from: string;                  // source node id
  to: string;                    // target node id
  label: string | null;          // optional edge description
}

export interface SolutionFlowData {
  nodes: FlowNode[];             // 3-8 nodes typical
  edges: FlowEdge[];
  errorNodeId: string | null;    // node where student went wrong (null for correct solutions)
  summary: string;               // one-line Korean summary
  conceptKeywords: string[];     // related concept tags
}

// ─────────────────────────────────────────────
// Type 2: Comparison — student vs correct side-by-side
// ─────────────────────────────────────────────

export type ComparisonStepStatus = 'correct' | 'error' | 'neutral';

export interface ComparisonStep {
  label: string;                 // Korean step description
  latex: string | null;          // formula for this step
  status: ComparisonStepStatus;
  annotation: string | null;     // what went wrong / what's correct
}

export interface ComparisonData {
  studentSteps: ComparisonStep[];
  correctSteps: ComparisonStep[];
  divergeIndex: number;          // index where student diverged from correct path
  summary: string;
  conceptKeywords: string[];
}

// ─────────────────────────────────────────────
// Type 3: FormulaBreakdown — line-by-line formula decomposition
// ─────────────────────────────────────────────

export interface FormulaLine {
  latex: string;                 // the formula for this line
  annotation: string;            // Korean explanation (e.g. "양변에 2를 곱하면")
  isError: boolean;              // true if this line contains the error
}

export interface FormulaBreakdownData {
  lines: FormulaLine[];          // sequential formula lines
  errorLineIndex: number | null; // index of the error line (null for correct solutions)
  summary: string;
  conceptKeywords: string[];
}

// ─────────────────────────────────────────────
// Discriminated Union
// ─────────────────────────────────────────────

export type VisualExplanationType = 'flow' | 'comparison' | 'formula';

export type VisualExplanation =
  | { type: 'flow'; data: SolutionFlowData }
  | { type: 'comparison'; data: ComparisonData }
  | { type: 'formula'; data: FormulaBreakdownData };
