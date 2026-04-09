import { Credit } from '../entities/Credit';
import { SubscriptionPlan } from '../value-objects/SubscriptionPlan';

const PLAN_LIMITS: Record<SubscriptionPlan, number> = {
  free: 30,
  standard: 150,
  premium: 400,
  season_pass: 150,
  parent: 0, // parents don't need credits
};

const COST_PER_QUESTION = 1; // 1 credit per question analyzed

export function hasSufficientCredits(credit: Credit, questionCount: number): boolean {
  const cost = calculateCost(questionCount);
  return (credit.total - credit.used) >= cost;
}

export function calculateCost(questionCount: number): number {
  return questionCount * COST_PER_QUESTION;
}

export function getPlanLimit(plan: SubscriptionPlan): number {
  return PLAN_LIMITS[plan];
}

export function getRemainingCredits(credit: Credit): number {
  return credit.total - credit.used;
}

export function isResetDue(credit: Credit): boolean {
  return new Date() >= new Date(credit.resetAt);
}
