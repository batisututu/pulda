import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { SolutionFlowData, FlowNode, FlowNodeStatus } from '@/domain/value-objects';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZE } from '@/presentation/theme';
import { MathText } from './MathText';

interface Props {
  data: SolutionFlowData;
}

// ── Topological sort (Kahn's algorithm) ──────────────────────

function topoSort(nodes: FlowNode[], edges: SolutionFlowData['edges']): FlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adj = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: FlowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);
    for (const next of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  // Append any remaining nodes not reached (safety)
  for (const n of nodes) {
    if (!sorted.find((s) => s.id === n.id)) sorted.push(n);
  }

  return sorted;
}

// ── Style helpers ────────────────────────────────────────────

const STATUS_STYLES: Record<FlowNodeStatus, { bg: string; border: string }> = {
  correct: { bg: '#ECFDF5', border: '#10B981' },
  error: { bg: '#FFF1F2', border: '#F43F5E' },
  neutral: { bg: COLORS.white, border: '#4F46E5' },
};

const TYPE_LABELS: Record<string, string> = {
  step: '단계',
  branch: '분기',
  error_point: '오류 지점',
  result: '결과',
};

// ── Component ────────────────────────────────────────────────

export function SolutionFlowView({ data }: Props) {
  const { nodes, edges, summary } = data;

  const sorted = useMemo(() => topoSort(nodes, edges), [nodes, edges]);

  // Build edge-label lookup keyed by "from->to"
  const edgeLabelMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of edges) {
      map.set(`${e.from}->${e.to}`, e.label);
    }
    return map;
  }, [edges]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {sorted.map((node, idx) => {
        const status = STATUS_STYLES[node.status];
        const isErrorPoint = node.type === 'error_point';
        const borderWidth = isErrorPoint ? 2.5 : 1.5;

        // Find edge label leading into this node (from previous node)
        let edgeLabel: string | null = null;
        if (idx > 0) {
          const prevId = sorted[idx - 1].id;
          edgeLabel = edgeLabelMap.get(`${prevId}->${node.id}`) ?? null;
        }

        return (
          <React.Fragment key={node.id}>
            {/* Connector between nodes */}
            {idx > 0 && (
              <View style={styles.connectorWrap}>
                <View style={styles.connectorLine} />
                <Text style={styles.arrow}>▼</Text>
                {edgeLabel != null && (
                  <Text style={styles.edgeLabel}>{edgeLabel}</Text>
                )}
              </View>
            )}

            {/* Node card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: status.bg,
                  borderColor: status.border,
                  borderWidth,
                },
              ]}
            >
              <Text style={[styles.typeLabel, { color: status.border }]}>
                {TYPE_LABELS[node.type] ?? node.type}
              </Text>
              <Text style={styles.nodeLabel}>{node.label}</Text>
              {node.latex != null && (
                <MathText latex={node.latex} fontSize={FONT_SIZE.sm} color={COLORS.textSecondary} />
              )}
            </View>
          </React.Fragment>
        );
      })}

      {/* Summary */}
      {summary.length > 0 && (
        <Text style={styles.summary}>{summary}</Text>
      )}
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  typeLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  nodeLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  latex: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  connectorWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
  },
  arrow: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textTertiary,
    marginTop: -2,
  },
  edgeLabel: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summary: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZE.sm,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
});
