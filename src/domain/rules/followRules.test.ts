import { canFollow, IS_PRIVATE_BY_DEFAULT, canSelfFollow } from '@/domain/rules/followRules';

describe('canFollow', () => {
  it('allows following when count is 0', () => {
    expect(canFollow(0)).toBe(true);
  });

  it('allows following when count is 199 (one below limit)', () => {
    expect(canFollow(199)).toBe(true);
  });

  it('disallows following when count is 200 (at limit)', () => {
    expect(canFollow(200)).toBe(false);
  });

  it('disallows following when count is 201 (above limit)', () => {
    expect(canFollow(201)).toBe(false);
  });
});

describe('canSelfFollow', () => {
  it('allows following a different user', () => {
    expect(canSelfFollow('a', 'b')).toBe(true);
  });

  it('disallows following yourself', () => {
    expect(canSelfFollow('a', 'a')).toBe(false);
  });
});

describe('IS_PRIVATE_BY_DEFAULT', () => {
  it('is true', () => {
    expect(IS_PRIVATE_BY_DEFAULT).toBe(true);
  });
});
