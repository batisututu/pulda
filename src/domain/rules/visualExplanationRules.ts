import type {
  VisualExplanation,
  SolutionFlowData,
  ComparisonData,
  FormulaBreakdownData,
} from '../value-objects/VisualExplanation';

/**
 * Validate a VisualExplanation by dispatching to the appropriate type-specific validator.
 */
export function isValidVisualExplanation(ve: VisualExplanation): boolean {
  switch (ve.type) {
    case 'flow':
      return isValidFlow(ve.data);
    case 'comparison':
      return isValidComparison(ve.data);
    case 'formula':
      return isValidFormula(ve.data);
    default:
      return false;
  }
}

/**
 * Validate a SolutionFlow diagram: DAG with >=2 nodes, valid edge refs, no cycles.
 */
export function isValidFlow(data: SolutionFlowData): boolean {
  const { nodes, edges, errorNodeId, summary } = data;

  if (!nodes || nodes.length < 2) return false;
  if (!summary || summary.trim().length === 0) return false;

  const nodeIds = new Set(nodes.map((n) => n.id));

  // errorNodeId is nullable (correct solutions have no error), but if set must be valid
  if (errorNodeId !== null && !nodeIds.has(errorNodeId)) return false;

  // All edges must reference valid nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) return false;
  }

  // DAG check: no cycles
  if (hasCycle(nodeIds, edges)) return false;

  return true;
}

/**
 * Validate a Comparison diagram: >=2 steps per side, valid divergeIndex.
 */
export function isValidComparison(data: ComparisonData): boolean {
  const { studentSteps, correctSteps, divergeIndex, summary } = data;

  if (!summary || summary.trim().length === 0) return false;
  if (!studentSteps || studentSteps.length < 2) return false;
  if (!correctSteps || correctSteps.length < 2) return false;
  if (divergeIndex < 0 || divergeIndex >= Math.min(studentSteps.length, correctSteps.length)) {
    return false;
  }

  return true;
}

/**
 * Validate a FormulaBreakdown: >=2 lines, valid errorLineIndex if set.
 */
export function isValidFormula(data: FormulaBreakdownData): boolean {
  const { lines, errorLineIndex, summary } = data;

  if (!summary || summary.trim().length === 0) return false;
  if (!lines || lines.length < 2) return false;

  // errorLineIndex is nullable (correct solutions), but if set must be in range
  if (errorLineIndex !== null) {
    if (errorLineIndex < 0 || errorLineIndex >= lines.length) return false;
  }

  return true;
}

// ─── Internal helpers ───

function hasCycle(
  nodeIds: Set<string>,
  edges: SolutionFlowData['edges']
): boolean {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  for (const id of nodeIds) {
    if (color.get(id) !== WHITE) continue;

    const stack: Array<{ node: string; childIdx: number }> = [
      { node: id, childIdx: 0 },
    ];
    color.set(id, GRAY);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = adj.get(frame.node) ?? [];

      if (frame.childIdx < children.length) {
        const child = children[frame.childIdx];
        frame.childIdx++;

        const childColor = color.get(child) ?? WHITE;
        if (childColor === GRAY) return true;
        if (childColor === WHITE) {
          color.set(child, GRAY);
          stack.push({ node: child, childIdx: 0 });
        }
      } else {
        color.set(frame.node, BLACK);
        stack.pop();
      }
    }
  }

  return false;
}
