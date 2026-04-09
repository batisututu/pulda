/**
 * AI API 호출에 타임아웃 적용 — 무한 대기 방지
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const result = await fn(controller.signal);
    return result;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`[Timeout] ${label} exceeded ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
