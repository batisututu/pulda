import { describe, it, expect } from 'vitest';
import { isValidVisualExplanation, isValidFlow, isValidComparison, isValidFormula } from './visualExplanationRules';
import type { VisualExplanation, SolutionFlowData, ComparisonData, FormulaBreakdownData } from '../value-objects/VisualExplanation';

// ─── Flow fixtures ───

function makeFlow(overrides: Partial<SolutionFlowData> = {}): SolutionFlowData {
  return {
    nodes: [
      { id: 'n1', type: 'step', label: '문제 해석', latex: null, status: 'correct' },
      { id: 'n2', type: 'error_point', label: '공식 적용 오류', latex: 'x^2', status: 'error' },
      { id: 'n3', type: 'result', label: '오답 도출', latex: null, status: 'error' },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: null },
      { from: 'n2', to: 'n3', label: '잘못된 계산' },
    ],
    errorNodeId: 'n2',
    summary: '이차방정식 근의 공식에서 판별식을 잘못 적용함',
    conceptKeywords: ['이차방정식', '근의 공식'],
    ...overrides,
  };
}

// ─── Comparison fixtures ───

function makeComparison(overrides: Partial<ComparisonData> = {}): ComparisonData {
  return {
    studentSteps: [
      { label: '식 정리', latex: '2x + 3 = 7', status: 'correct', annotation: null },
      { label: '양변에서 3 빼기', latex: '2x = 4', status: 'correct', annotation: null },
      { label: '양변을 2로 나누기', latex: 'x = 3', status: 'error', annotation: '계산 실수: 4÷2=2' },
    ],
    correctSteps: [
      { label: '식 정리', latex: '2x + 3 = 7', status: 'correct', annotation: null },
      { label: '양변에서 3 빼기', latex: '2x = 4', status: 'correct', annotation: null },
      { label: '양변을 2로 나누기', latex: 'x = 2', status: 'correct', annotation: '4÷2=2' },
    ],
    divergeIndex: 2,
    summary: '나눗셈 계산에서 실수',
    conceptKeywords: ['일차방정식'],
    ...overrides,
  };
}

// ─── Formula fixtures ───

function makeFormula(overrides: Partial<FormulaBreakdownData> = {}): FormulaBreakdownData {
  return {
    lines: [
      { latex: '2x + 3 = 7', annotation: '주어진 방정식', isError: false },
      { latex: '2x = 4', annotation: '양변에서 3을 뺌', isError: false },
      { latex: 'x = 3', annotation: '양변을 2로 나눔 (오류!)', isError: true },
    ],
    errorLineIndex: 2,
    summary: '나눗셈 결과 오류',
    conceptKeywords: ['일차방정식'],
    ...overrides,
  };
}

describe('isValidVisualExplanation', () => {
  it('dispatches to flow validator', () => {
    const ve: VisualExplanation = { type: 'flow', data: makeFlow() };
    expect(isValidVisualExplanation(ve)).toBe(true);
  });

  it('dispatches to comparison validator', () => {
    const ve: VisualExplanation = { type: 'comparison', data: makeComparison() };
    expect(isValidVisualExplanation(ve)).toBe(true);
  });

  it('dispatches to formula validator', () => {
    const ve: VisualExplanation = { type: 'formula', data: makeFormula() };
    expect(isValidVisualExplanation(ve)).toBe(true);
  });
});

describe('isValidFlow', () => {
  it('accepts valid flow', () => {
    expect(isValidFlow(makeFlow())).toBe(true);
  });

  it('rejects <2 nodes', () => {
    expect(isValidFlow(makeFlow({
      nodes: [{ id: 'n1', type: 'step', label: 'x', latex: null, status: 'neutral' }],
      edges: [],
    }))).toBe(false);
  });

  it('rejects empty summary', () => {
    expect(isValidFlow(makeFlow({ summary: '   ' }))).toBe(false);
  });

  it('rejects invalid errorNodeId', () => {
    expect(isValidFlow(makeFlow({ errorNodeId: 'n999' }))).toBe(false);
  });

  it('accepts null errorNodeId (correct solution)', () => {
    expect(isValidFlow(makeFlow({ errorNodeId: null }))).toBe(true);
  });

  it('rejects edge referencing nonexistent node', () => {
    expect(isValidFlow(makeFlow({
      edges: [{ from: 'n1', to: 'n999', label: null }],
    }))).toBe(false);
  });

  it('rejects cycle', () => {
    expect(isValidFlow(makeFlow({
      edges: [
        { from: 'n1', to: 'n2', label: null },
        { from: 'n2', to: 'n3', label: null },
        { from: 'n3', to: 'n1', label: null },
      ],
    }))).toBe(false);
  });
});

describe('isValidComparison', () => {
  it('accepts valid comparison', () => {
    expect(isValidComparison(makeComparison())).toBe(true);
  });

  it('rejects <2 student steps', () => {
    expect(isValidComparison(makeComparison({
      studentSteps: [{ label: 'x', latex: null, status: 'neutral', annotation: null }],
      divergeIndex: 0,
    }))).toBe(false);
  });

  it('rejects <2 correct steps', () => {
    expect(isValidComparison(makeComparison({
      correctSteps: [{ label: 'x', latex: null, status: 'correct', annotation: null }],
      divergeIndex: 0,
    }))).toBe(false);
  });

  it('rejects divergeIndex out of range', () => {
    expect(isValidComparison(makeComparison({ divergeIndex: 10 }))).toBe(false);
    expect(isValidComparison(makeComparison({ divergeIndex: -1 }))).toBe(false);
  });

  it('rejects empty summary', () => {
    expect(isValidComparison(makeComparison({ summary: '' }))).toBe(false);
  });
});

describe('isValidFormula', () => {
  it('accepts valid formula', () => {
    expect(isValidFormula(makeFormula())).toBe(true);
  });

  it('rejects <2 lines', () => {
    expect(isValidFormula(makeFormula({
      lines: [{ latex: 'x=1', annotation: 'test', isError: false }],
    }))).toBe(false);
  });

  it('rejects errorLineIndex out of range', () => {
    expect(isValidFormula(makeFormula({ errorLineIndex: 10 }))).toBe(false);
    expect(isValidFormula(makeFormula({ errorLineIndex: -1 }))).toBe(false);
  });

  it('accepts null errorLineIndex (correct solution)', () => {
    expect(isValidFormula(makeFormula({ errorLineIndex: null }))).toBe(true);
  });

  it('rejects empty summary', () => {
    expect(isValidFormula(makeFormula({ summary: '' }))).toBe(false);
  });
});
