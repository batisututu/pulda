/**
 * 리포지토리 에러 생성 헬퍼 — 에러 메시지에 컨텍스트 정보 포함
 */
import { RepositoryError } from '@/shared/errors';

export function repoError(
  repo: string,
  method: string,
  error: { message: string; code?: string },
  context?: Record<string, unknown>,
): RepositoryError {
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return new RepositoryError(`[${repo}.${method}] ${error.message}${contextStr}`);
}
