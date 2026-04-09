/**
 * generate-variants Edge Function
 *
 * On-demand L4 variant question generation for a specific error diagnosis.
 * L4b: AI-powered answer verification using a separate model (OpenAI GPT-4o-mini).
 *
 * Input: { diagnosisId: string, count: number }
 * Output: { diagnosisId, variants[], creditsUsed }
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
 */

import Anthropic from "npm:@anthropic-ai/sdk";
import OpenAI from "npm:openai@4";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserId } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { withTimeout } from "../_shared/timeout.ts";
import { extractJson } from "../_shared/extractJson.ts";
import { withRetry } from "../_shared/retry.ts";
import {
  buildVariantSystem,
  VariantRaw,
  parseVisualExplanation,
} from "../_shared/variantTypes.ts";

// ---------------------------------------------------------------------------
// SDK clients
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const OPENAI_MODEL = "gpt-4o-mini";
const MIN_COUNT = 1;
const MAX_COUNT = 5;

// ---------------------------------------------------------------------------
// L4b: 변형문항 정답 검증 시스템 프롬프트 및 스키마
// ---------------------------------------------------------------------------

const VERIFY_SYSTEM = [
  "당신은 한국 시험 정답 검증 전문가입니다.",
  "주어진 문제를 독립적으로 풀어서 정답과 간단한 풀이를 제공합니다.",
  "",
  "규칙:",
  "1. 문제를 처음부터 직접 풀어주세요. 기존 정답에 의존하지 마세요.",
  "2. 수학 수식은 LaTeX 형태($...$)로 작성하세요.",
  "3. brief_solution은 핵심 풀이 과정만 간결하게 작성하세요 (3-5줄).",
  "4. 객관식이면 answer에 번호를, 주관식이면 답 자체를 적어주세요.",
  "",
  "반드시 JSON만 응답하세요.",
].join("\n");

const VERIFY_SCHEMA = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const },
    brief_solution: { type: "string" as const },
  },
  required: ["answer", "brief_solution"] as const,
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// DB Row types
// ---------------------------------------------------------------------------

interface DiagnosisRow {
  id: string;
  question_id: string;
  error_type: string;
  confidence: number;
  reasoning: string;
  correction: string;
  step_by_step: string | null;
}

interface QuestionRow {
  id: string;
  exam_id: string;
  subject: string;
  number: number;
  content: string;
  question_type: string;
  options: string[] | null;
  answer: string | null;
  student_answer: string | null;
  is_correct: boolean | null;
}

interface ExamRow {
  id: string;
  user_id: string;
}

// ---------------------------------------------------------------------------
// L4b: 변형문항 정답 독립 검증 (OpenAI GPT-4o-mini)
// ---------------------------------------------------------------------------

async function verifyVariantAnswer(
  content: string,
  options: string[] | null,
  questionType: string,
  subject: string,
): Promise<{ answer: string; briefSolution: string }> {
  const lines: string[] = [];
  lines.push("## 문제 정보");
  lines.push(`- 과목: ${subject}`);
  lines.push(`- 유형: ${questionType}`);
  lines.push("");
  lines.push("## 문제 내용");
  lines.push(content);
  if (options) {
    lines.push("");
    lines.push("## 보기");
    options.forEach((opt: string, i: number) => {
      lines.push(`${i + 1}. ${opt}`);
    });
  }
  lines.push("");
  lines.push("이 문제를 독립적으로 풀어서 정답과 풀이를 제공해주세요.");

  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          openai.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: 1024,
            messages: [
              { role: "system", content: VERIFY_SYSTEM },
              { role: "user", content: lines.join("\n") },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "verification",
                strict: true,
                schema: VERIFY_SCHEMA,
              },
            },
            signal,
          }),
        3,
        1000,
        signal,
      ),
    30000,
    "Variant Verification API",
  );

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(rawText));
  return {
    answer: String(parsed.answer ?? ""),
    briefSolution: String(parsed.brief_solution ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- 1. Auth ---
    const userId = await getUserId(req);
    if (!userId) {
      return errorResponse("Authentication required", 401, "UNAUTHORIZED");
    }

    // --- 2. Parse input ---
    const body = await req.json();
    const { diagnosisId, count } = body;

    if (!diagnosisId || typeof diagnosisId !== "string") {
      return errorResponse(
        "diagnosisId is required",
        400,
        "VALIDATION_ERROR",
      );
    }

    const variantCount = Number(count);
    if (
      !Number.isInteger(variantCount) ||
      variantCount < MIN_COUNT ||
      variantCount > MAX_COUNT
    ) {
      return errorResponse(
        `Variant count must be between ${MIN_COUNT} and ${MAX_COUNT}`,
        400,
        "VALIDATION_ERROR",
      );
    }

    // --- 3. Load diagnosis ---
    const { data: diagnosis, error: diagErr } = await supabaseAdmin
      .from("error_diagnoses")
      .select(
        "id, question_id, error_type, confidence, reasoning, correction, step_by_step",
      )
      .eq("id", diagnosisId)
      .single<DiagnosisRow>();

    if (diagErr || !diagnosis) {
      return errorResponse("Diagnosis not found", 404, "NOT_FOUND");
    }

    // --- 4. Load question ---
    const { data: question, error: qErr } = await supabaseAdmin
      .from("questions")
      .select(
        "id, exam_id, subject, number, content, question_type, options, answer, student_answer, is_correct",
      )
      .eq("id", diagnosis.question_id)
      .single<QuestionRow>();

    if (qErr || !question) {
      return errorResponse("Question not found", 404, "NOT_FOUND");
    }

    // --- 5. Load exam and verify ownership ---
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select("id, user_id")
      .eq("id", question.exam_id)
      .single<ExamRow>();

    if (examErr || !exam) {
      return errorResponse("Exam not found", 404, "NOT_FOUND");
    }

    if (exam.user_id !== userId) {
      return errorResponse(
        "Access denied: not the exam owner",
        403,
        "FORBIDDEN",
      );
    }

    // --- 5b. 사용자 학년 정보 로드 (프롬프트 컨텍스트용) ---
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id, grade")
      .eq("id", userId)
      .single();
    const grade =
      (userRow as { grade: string | null } | null)?.grade ?? "high1";

    // --- 6. Generate variants via Anthropic ---
    const optionsText = question.options
      ? "\n보기:\n" +
        question.options
          .map((o: string, i: number) => `${i + 1}. ${o}`)
          .join("\n")
      : "";

    const userPrompt = [
      "## 오답 진단 결과",
      `- 오답 유형: ${diagnosis.error_type}`,
      `- 원인 분석: ${diagnosis.reasoning}`,
      `- 교정 안내: ${diagnosis.correction}`,
      "",
      "## 학생 정보",
      `- 학년: ${grade}`,
      `- 과목: ${question.subject}`,
      "",
      "## 원본 문제",
      question.content,
      optionsText,
      question.answer ? `정답: ${question.answer}` : "",
      "",
      "## 요청",
      `위 진단 결과를 바탕으로 약점 교정용 변형문항 ${variantCount}개를 생성하세요.`,
    ]
      .filter(Boolean)
      .join("\n");

    // 과목/학년별 변형문항 프롬프트 생성
    const variantSystem = buildVariantSystem(question.subject, grade);

    // 변형문항 생성 API 호출 — withRetry에 signal 전달하여 타임아웃 시 재시도 즉시 중단
    const response = await withTimeout(
      (signal) =>
        withRetry(
          () =>
            anthropic.messages.create({
              model: ANTHROPIC_MODEL,
              max_tokens: 4096,
              system: variantSystem,
              messages: [{ role: "user", content: userPrompt }],
              signal,
            }),
          3,
          1000,
          signal,
        ),
      30000,
      "Variant Generation API",
    );

    const rawText = response.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text: string }) => b.text)
      .join("");

    const parsed = JSON.parse(extractJson(rawText)) as {
      variants: VariantRaw[];
    };
    const variants = parsed.variants ?? [];

    if (variants.length === 0) {
      return errorResponse(
        "AI failed to generate variants",
        503,
        "AI_GENERATION_FAILED",
      );
    }

    // --- 7. Save variants to DB ---
    const rows = variants.map((v) => ({
      diagnosis_id: diagnosis.id,
      content: v.content,
      question_type: v.type,
      options: v.options,
      answer: v.answer,
      explanation: v.explanation,
      difficulty: v.difficulty,
      target_error_type: v.target_error_type,
      bloom_level: v.bloom_level,
      trap_point: v.trap_point,
      target_time_seconds: v.target_time_seconds,
      verification_result: null,
      visual_explanation: parseVisualExplanation(v.visual_explanation),
      user_id: null,
      topic: null,
      grade: null,
    }));

    const { data: savedVariants, error: insertErr } = await supabaseAdmin
      .from("variant_questions")
      .insert(rows)
      .select("*");

    if (insertErr) {
      console.error("[generate-variants] Insert error:", insertErr);
      return errorResponse("Failed to save variants", 500, "DB_ERROR");
    }

    // --- 7b. L4b: 변형문항 정답 검증 (비동기, 실패해도 응답에 영향 없음) ---
    await Promise.allSettled(
      (savedVariants ?? []).map(async (sv: Record<string, unknown>) => {
        try {
          const verification = await verifyVariantAnswer(
            sv.content as string,
            sv.options as string[] | null,
            sv.question_type as string,
            question.subject,
          );
          const genAnswer = String(sv.answer ?? "");
          const verAnswer = verification.answer;
          const normalizedGen = genAnswer.replace(/\s+/g, "").toLowerCase();
          const normalizedVer = verAnswer.replace(/\s+/g, "").toLowerCase();
          const match = normalizedGen === normalizedVer;

          await supabaseAdmin
            .from("variant_questions")
            .update({
              verification_result: {
                verified: true,
                ai_computed_answer: verAnswer,
                generated_answer: genAnswer,
                match,
                confidence: match ? "high" : "low",
              },
            })
            .eq("id", sv.id);
        } catch (verErr) {
          console.warn(
            "[generate-variants] Verification failed for variant:",
            sv.id,
            verErr,
          );
        }
      }),
    );

    // --- 8. Map to camelCase response ---
    const mappedVariants = (savedVariants ?? []).map(
      (v: Record<string, unknown>) => ({
        id: v.id,
        diagnosisId: v.diagnosis_id,
        content: v.content,
        questionType: v.question_type,
        options: v.options,
        answer: v.answer,
        explanation: v.explanation,
        difficulty: v.difficulty,
        targetErrorType: v.target_error_type,
        bloomLevel: v.bloom_level,
        trapPoint: v.trap_point,
        targetTimeSeconds: v.target_time_seconds,
        createdAt: v.created_at,
      }),
    );

    return jsonResponse({
      diagnosisId: diagnosis.id,
      variants: mappedVariants,
      creditsUsed: 0, // 온디맨드 변형문항은 현재 무료 (GenerateVariantsUseCase 기준)
    });
  } catch (error: unknown) {
    console.error("[generate-variants] Unhandled error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      (error as { statusCode?: number })?.statusCode ??
      (error as { status?: number })?.status ??
      500;

    return errorResponse(message, status, "INTERNAL_ERROR");
  }
});
