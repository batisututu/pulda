/**
 * Retry utility with exponential backoff and jitter.
 * Used by AI gateway adapters to handle transient API failures.
 */

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503];

// 재시도 가능한 네트워크 에러 코드
const RETRYABLE_NETWORK_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'FETCH_ERROR'];

// 최대 대기 시간 상한 (30초)
const MAX_DELAY_MS = 30_000;

/**
 * 에러가 재시도 가능한지 판단
 * - HTTP 상태 코드 429/5xx: 서버 과부하 또는 일시 장애
 * - 네트워크 에러 코드: 연결 리셋, 타임아웃 등
 */
function isRetryable(error: unknown): boolean {
  const statusCode =
    (error as { status?: number })?.status ??
    (error as { statusCode?: number })?.statusCode ??
    (error as { response?: { status?: number } })?.response?.status;

  if (statusCode !== undefined) {
    return RETRYABLE_STATUS_CODES.includes(statusCode);
  }

  // 상태 코드가 없는 경우 네트워크 에러 코드 확인
  const networkCode = (error as { code?: string })?.code;
  if (networkCode !== undefined) {
    return RETRYABLE_NETWORK_CODES.includes(networkCode);
  }

  // 상태 코드도 네트워크 코드도 없으면 재시도 (예: 파싱 불가 에러)
  return true;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      // 재시도 불가 에러이거나 마지막 시도이면 즉시 throw
      if (!isRetryable(error) || attempt === maxRetries) {
        throw error;
      }

      // 지수 백오프: 비례 지터 적용 (delay * 0.5 ~ delay * 1.0), 최대 30초 상한
      const rawDelay = baseDelay * Math.pow(2, attempt);
      const jitteredDelay = rawDelay * (0.5 + Math.random() * 0.5);
      const delay = Math.min(jitteredDelay, MAX_DELAY_MS);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // 루프 탈출 불가 경로 — TypeScript 요구 사항
  throw lastError;
}
