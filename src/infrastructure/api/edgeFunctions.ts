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
    throw new Error(error.message ?? `Edge Function "${name}" failed`);
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
