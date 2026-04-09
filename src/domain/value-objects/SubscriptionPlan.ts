/**
 * Subscription plan tiers.
 * - free: Default tier with limited credits
 * - standard: Entry-level paid plan
 * - premium: Full-access paid plan
 * - season_pass: Time-limited exam season bundle
 * - parent: Parent account (no credits needed)
 */
export type SubscriptionPlan = 'free' | 'standard' | 'premium' | 'season_pass' | 'parent';
