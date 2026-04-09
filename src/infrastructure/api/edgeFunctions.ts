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
  // ES256 유저 JWT는 Supabase Edge Function 게이트웨이에서 거부됨 (HS256만 수용)
  // Authorization 헤더는 SDK가 anon key로 설정 → 게이트웨이 통과
  // 유저 토큰은 x-user-token 커스텀 헤더로 전달 → auth.ts에서 읽음
  const { data: { session } } = await supabase.auth.getSession();
  const authHeaders: Record<string, string> = {};
  if (session?.access_token) {
    authHeaders['x-user-token'] = session.access_token;
    console.log(`[EdgeFn] Invoking "${name}" (auth: x-user-token present)`);
  } else {
    console.warn(`[EdgeFn] Invoking "${name}" WITHOUT auth token!`);
  }

  const result = await supabase.functions.invoke(name, {
    body,
    headers: authHeaders,
  });

  // 전체 결과 구조 디버깅
  console.log(`[EdgeFn] "${name}" raw result:`, {
    hasData: result.data != null,
    dataType: typeof result.data,
    hasError: result.error != null,
    errorName: result.error?.name,
    errorMessage: result.error?.message,
    hasContext: !!(result.error as unknown as Record<string, unknown>)?.context,
  });

  if (result.error) {
    let code = 'UNKNOWN';
    let msg = result.error.message ?? `Edge Function "${name}" failed`;

    // FunctionsHttpError.context는 Response 객체
    const ctx = (result.error as unknown as { context?: Response }).context;
    if (ctx) {
      console.log(`[EdgeFn] "${name}" error context:`, {
        status: ctx.status,
        statusText: ctx.statusText,
        bodyUsed: ctx.bodyUsed,
        type: ctx.type,
      });

      if (!ctx.bodyUsed) {
        try {
          const errorBody = await ctx.json();
          console.log(`[EdgeFn] "${name}" error body:`, errorBody);
          if (errorBody.error) msg = String(errorBody.error);
          if (errorBody.code) code = String(errorBody.code);
        } catch (parseErr) {
          console.warn(`[EdgeFn] "${name}" body parse failed:`, parseErr);
        }
      }
    }

    console.error(`[EdgeFn] "${name}" FAILED:`, { code, msg });
    const err = new Error(msg) as Error & { code?: string };
    err.code = code;
    throw err;
  }

  console.log(`[EdgeFn] "${name}" SUCCESS`);
  return result.data as T;
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
