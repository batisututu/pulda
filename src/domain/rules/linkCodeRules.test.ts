import { generateLinkCode, isCodeExpired } from '@/domain/rules/linkCodeRules';

// NOTE: linkCodeRules.ts uses a 24-hour expiry (CODE_EXPIRY_HOURS = 24).
// The shared/constants/index.ts file defines LINK_CODE_EXPIRY_MINUTES = 30 which is
// NOT used by linkCodeRules.ts. This discrepancy may need reconciliation in the future.

describe('generateLinkCode', () => {
  const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  it('generates a code of length 6', () => {
    const code = generateLinkCode();
    expect(code).toHaveLength(6);
  });

  it('only contains allowed characters', () => {
    const code = generateLinkCode();
    for (const char of code) {
      expect(ALLOWED_CHARS).toContain(char);
    }
  });

  it('does not contain ambiguous characters 0, O, 1, I, l', () => {
    // Generate multiple codes to increase confidence
    for (let i = 0; i < 50; i++) {
      const code = generateLinkCode();
      expect(code).not.toMatch(/[0O1Il]/);
    }
  });

  it('generates different codes on consecutive calls (high probability)', () => {
    const code1 = generateLinkCode();
    const code2 = generateLinkCode();
    expect(code1).not.toBe(code2);
  });
});

describe('isCodeExpired', () => {
  it('returns false for a code created 23 hours ago', () => {
    const createdAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(isCodeExpired(createdAt)).toBe(false);
  });

  it('returns true for a code created 25 hours ago', () => {
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isCodeExpired(createdAt)).toBe(true);
  });

  it('returns true at the boundary (24 hours + 1ms, uses > check)', () => {
    const createdAt = new Date(Date.now() - (24 * 60 * 60 * 1000 + 1));
    expect(isCodeExpired(createdAt)).toBe(true);
  });
});
