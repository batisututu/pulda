import { trackCost, costTracker } from '@/infrastructure/ai/costTracker';

describe('trackCost', () => {
  it('returns correct cost for gpt-4o-mini', () => {
    // (1000/1M)*0.15 + (500/1M)*0.60 = 0.000150 + 0.000300 = 0.000450
    const cost = trackCost('gpt-4o-mini', 1000, 500);
    expect(cost).toBeCloseTo(0.000450, 8);
  });

  it('returns correct cost for gpt-4o', () => {
    // (10000/1M)*2.50 + (2000/1M)*10.0 = 0.025 + 0.02 = 0.045
    const cost = trackCost('gpt-4o', 10000, 2000);
    expect(cost).toBeCloseTo(0.045, 8);
  });

  it('returns 0 for unknown model without side effects', () => {
    // 알 수 없는 모델은 console 출력 없이 0 반환
    const cost = trackCost('gpt-3.5-turbo', 1000, 500);
    expect(cost).toBe(0);
  });

  it('calculates cost correctly: gpt-4o-mini 1000in 500out = $0.000450', () => {
    // (1000/1_000_000)*0.15 + (500/1_000_000)*0.60 = 0.000150 + 0.000300 = 0.000450
    const cost = trackCost('gpt-4o-mini', 1000, 500);
    expect(cost.toFixed(6)).toBe('0.000450');
  });
});

describe('costTracker.log', () => {
  it('returns correct costUsd for known model with layer and latency', () => {
    // (2000/1M)*0.15 + (1000/1M)*0.60 = 0.0003 + 0.0006 = 0.0009
    const result = costTracker.log({
      model: 'gpt-4o-mini',
      inputTokens: 2000,
      outputTokens: 1000,
      latencyMs: 350,
      layer: 'L1',
    });

    expect(result.costUsd).toBeCloseTo(0.0009, 8);
  });

  it('returns costUsd=0 for unknown model without side effects', () => {
    // 알 수 없는 모델 — console 출력 없이 0 반환
    const result = costTracker.log({
      model: 'claude-3-opus',
      inputTokens: 500,
      outputTokens: 200,
      latencyMs: 1000,
      layer: 'L2',
    });

    expect(result.costUsd).toBe(0);
  });

  it('returns correct costUsd for claude-sonnet-4-20250514', () => {
    // (1000/1M)*3.0 + (500/1M)*15.0 = 0.003 + 0.0075 = 0.0105
    const result = costTracker.log({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      latencyMs: 500,
      layer: 'L3a',
    });

    expect(result.costUsd).toBeCloseTo(0.0105, 8);
  });
});
