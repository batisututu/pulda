/**
 * 문제 내용 해시 — 캐시 키 생성용 (SHA-256)
 *
 * Deno 환경에서 Web Crypto API 사용
 */

/**
 * 문제 내용을 정규화한 후 SHA-256 해시 생성
 * - 공백 통일, LaTeX 공백 제거, 소문자 변환
 */
export async function computeContentHash(content: string): Promise<string> {
  const normalized = content
    .replace(/\s+/g, " ")
    .replace(/\\,|\\;|\\!/g, "")
    .trim()
    .toLowerCase();

  const buffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
