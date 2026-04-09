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
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    // Edge Function이 반환한 구조화된 에러 코드 보존
    // 서버 errorResponse()는 { error: string, code: string } 형태로 반환
    const structuredData = data as Record<string, unknown> | null;
    const code = structuredData?.code as string | undefined;
    const msg = (structuredData?.error as string) ?? error.message ?? `Edge Function "${name}" failed`;
    const err = new Error(msg) as Error & { code?: string };
    err.code = code ?? 'UNKNOWN';
    throw err;
  }

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
