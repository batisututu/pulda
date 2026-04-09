/**
 * Retry with exponential backoff, jitter, and abort signal awareness.
 *
 * 개선 사항 (vs 기존 Edge Function 인라인 버전):
 * - AbortSignal 인식: 타임아웃 후 불필요한 재시도 방지
 * - 네트워크 에러 코드 감지 (ECONNRESET, ETIMEDOUT 등)
 * - 최대 대기 시간 상한 (30초)
 * - 비례 지터 적용 (delay * 0.5 ~ delay * 1.0)
 */

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503];

// 재시도 가능한 네트워크 에러 코드
const RETRYABLE_NETWORK_CODES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "FETCH_ERROR",
];

// 최대 대기 시간 상한 (30초)
const MAX_DELAY_MS = 30_000;

/**
 * 에러가 재시도 가능한지 판단
 */
function isRetryable(error: unknown): boolean {
  // AbortError는 타임아웃으로 인한 중단 — 재시도 불가
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }

  const statusCode =
    (error as { status?: number })?.status ??
    (error as { statusCode?: number })?.statusCode ??
    (error as { response?: { status?: number } })?.response?.status;

  if (statusCode !== undefined) {
    return RETRYABLE_STATUS_CODES.includes(statusCode);
  }

  // 네트워크 에러 코드 확인
  const networkCode = (error as { code?: string })?.code;
  if (networkCode !== undefined) {
    return RETRYABLE_NETWORK_CODES.includes(networkCode);
  }

  // 상태 코드도 네트워크 코드도 없으면 재시도 허용
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 타임아웃 시그널이 이미 중단된 경우 즉시 중지
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (!isRetryable(error) || attempt === maxRetries) {
        throw error;
      }

      // 지수 백오프 + 비례 지터, 최대 30초 상한
      const rawDelay = baseDelay * Math.pow(2, attempt);
      const jitteredDelay = rawDelay * (0.5 + Math.random() * 0.5);
      const delay = Math.min(jitteredDelay, MAX_DELAY_MS);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
