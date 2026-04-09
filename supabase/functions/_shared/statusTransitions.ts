/**
 * 시험 상태 전이 규칙 — domain/rules/examRules 미러링
 */

export const VALID_TRANSITIONS: Record<string, string[]> = {
  processing: ["ocr_done", "error"],
  ocr_done: ["verified", "error"],
  verified: ["analyzed", "error"],
  analyzed: ["completed", "error"],
  completed: [],
  error: ["processing", "verified"],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isExpired(expiresAt: string): boolean {
  return new Date() > new Date(expiresAt);
}
