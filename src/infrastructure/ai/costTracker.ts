/**
 * AI cost tracking utility.
 * 모델별 토큰 사용량과 USD 비용을 계산하는 유틸리티.
 * 프로덕션에서는 외부 로그 수집 시스템에 전달하기 위한 계산만 수행함.
 */

interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  layer: 'L1' | 'L2' | 'L3a' | 'L3b' | 'L4' | 'L4-verify';
}

/** 1M 토큰당 가격 (USD) */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.0 },
  // Claude Sonnet 가격 (2025-05-14 버전 기준)
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
};

/**
 * 모델, 토큰 수를 받아 USD 비용을 계산해 반환.
 * 알 수 없는 모델은 0을 반환하고 조용히 무시.
 */
export function trackCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model];

  // 알 수 없는 모델은 조용히 0 반환 (프로덕션에서 console.warn 금지)
  if (!pricing) {
    return 0;
  }

  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  return costUsd;
}

/**
 * 레이어 및 레이턴시 정보를 포함한 확장 비용 트래커.
 * AI 게이트웨이 어댑터에서 파이프라인 비용 추적에 사용.
 */
export const costTracker = {
  /**
   * 비용을 계산해 CostEntry 형태로 반환.
   * 알 수 없는 모델이면 costUsd=0으로 반환.
   */
  log(entry: CostEntry): { costUsd: number } {
    const pricing = PRICING[entry.model];

    // 알 수 없는 모델 — 조용히 0 반환
    if (!pricing) {
      return { costUsd: 0 };
    }

    const costUsd =
      (entry.inputTokens / 1_000_000) * pricing.input +
      (entry.outputTokens / 1_000_000) * pricing.output;

    return { costUsd };
  },
};
