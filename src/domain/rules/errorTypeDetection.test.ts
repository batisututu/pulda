import { determineConfidence, ERROR_TYPE_CONFIG } from '@/domain/rules/errorTypeDetection';

describe('determineConfidence', () => {
  it('returns baseConfidence when primary and verifier match exactly', () => {
    expect(determineConfidence('3x', '3x', 0.9)).toBe(0.9);
  });

  it('returns baseConfidence when answers match after whitespace normalization', () => {
    expect(determineConfidence(' 3x ', '3x', 0.9)).toBe(0.9);
  });

  it('returns min(baseConfidence, 0.5) when answers differ and base is high', () => {
    expect(determineConfidence('3x', '4x', 0.9)).toBe(0.5);
  });

  it('returns min(baseConfidence, 0.5) when answers differ and base is lower than 0.5', () => {
    expect(determineConfidence('3x', '4x', 0.3)).toBe(0.3);
  });
});

describe('ERROR_TYPE_CONFIG', () => {
  it('has concept_gap, calculation_error, and time_pressure keys', () => {
    expect(ERROR_TYPE_CONFIG).toHaveProperty('concept_gap');
    expect(ERROR_TYPE_CONFIG).toHaveProperty('calculation_error');
    expect(ERROR_TYPE_CONFIG).toHaveProperty('time_pressure');
  });

  it('maps concept_gap to rose color #F43F5E', () => {
    expect(ERROR_TYPE_CONFIG.concept_gap.color).toBe('#F43F5E');
  });

  it('maps calculation_error to amber color #F59E0B', () => {
    expect(ERROR_TYPE_CONFIG.calculation_error.color).toBe('#F59E0B');
  });

  it('maps time_pressure to blue color #3B82F6', () => {
    expect(ERROR_TYPE_CONFIG.time_pressure.color).toBe('#3B82F6');
  });
});
