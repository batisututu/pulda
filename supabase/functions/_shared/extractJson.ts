/**
 * AI 응답에서 JSON 문자열 추출 — 마크다운 코드펜스 처리
 */
export function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text.trim();
}
