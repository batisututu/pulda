/**
 * Edge Function invocation wrappers.
 * Calls Supabase Edge Functions from the mobile client.
 */
import { supabase } from './supabaseClient';

interface RunOcrResponse {
  examId: string;
  status: string;
  questionsCount: number;
}

interface AnalyzeExamResponse {
  examId: string;
  status: string;
  summary: {
    correctCount: number;
    wrongCount: number;
    accuracy: number;
  };
  diagnosesCount: number;
  variantsCount: number;
}

interface GenerateVariantsResponse {
  diagnosisId: string;
  variants: unknown[];
  creditsUsed: number;
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  console.log(`[EdgeFn] Invoking "${name}"`, body);

  // 세션 토큰을 명시적으로 첨부 — 웹에서 SDK 자동 첨부가 실패할 수 있음
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const { data, error, response } = await supabase.functions.invoke(name, {
    body,
    headers,
  }) as { data: T | null; error: Error | null; response?: Response };

  if (error) {
    // Supabase SDK는 non-2xx 응답 시 data=null 반환 — Response 본문에서 에러 상세 추출
    let code = 'UNKNOWN';
    let msg = error.message ?? `Edge Function "${name}" failed`;

    // error.context (FunctionsHttpError) 또는 response에서 JSON 본문 읽기
    const res = (error as Error & { context?: Response }).context ?? response;
    if (res && !res.bodyUsed) {
      try {
        const errorBody = await res.json() as Record<string, unknown>;
        if (errorBody.error) msg = String(errorBody.error);
        if (errorBody.code) code = String(errorBody.code);
      } catch {
        // JSON 파싱 실패 — 기본 에러 메시지 사용
      }
    }

    console.error(`[EdgeFn] "${name}" failed:`, { code, msg, status: res?.status });
    const err = new Error(msg) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  console.log(`[EdgeFn] "${name}" success`);
  return data as T;
}

/**
 * Invoke the run-ocr Edge Function (L1 pipeline).
 * Triggers OCR on an uploaded exam image.
 */
export async function invokeRunOcr(examId: string): Promise<RunOcrResponse> {
  return invokeFunction<RunOcrResponse>('run-ocr', { examId });
}

/**
 * Invoke the analyze-exam Edge Function (L2+L3+L4 pipeline).
 * Runs classification, diagnosis, and variant generation.
 */
export async function invokeAnalyzeExam(examId: string): Promise<AnalyzeExamResponse> {
  return invokeFunction<AnalyzeExamResponse>('analyze-exam', { examId });
}

/**
 * Invoke the generate-variants Edge Function (on-demand L4).
 * Generates additional variant questions for a diagnosis.
 */
export async function invokeGenerateVariants(
  diagnosisId: string,
  count: number,
): Promise<GenerateVariantsResponse> {
  return invokeFunction<GenerateVariantsResponse>('generate-variants', {
    diagnosisId,
    count,
  });
}
