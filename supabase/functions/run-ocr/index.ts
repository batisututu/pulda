/**
 * run-ocr Edge Function
 *
 * L1: OCR pipeline for uploaded exam images.
 * Uses GPT-4o-mini Vision to extract questions from Korean exam paper images.
 *
 * Pipeline:
 *  1. Auth + validation (ownership, status transition)
 *  2. Download exam image from Supabase Storage -> base64
 *  3. Call OpenAI GPT-4o-mini Vision (Korean exam OCR specialist)
 *  4. Parse JSON response -> questions array
 *  5. Save ocr_result on exam row
 *  6. Insert questions into questions table
 *  7. Update exam status -> "ocr_done"
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import OpenAI from "npm:openai@4";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserId } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { withTimeout } from "../_shared/timeout.ts";
import { extractJson } from "../_shared/extractJson.ts";
import { withRetry } from "../_shared/retry.ts";
import { canTransition } from "../_shared/statusTransitions.ts";

// ---------------------------------------------------------------------------
// SDK client (initialized once per cold start)
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_MODEL = "gpt-4o-mini";

// ---------------------------------------------------------------------------
// DB Row types (snake_case, matching Supabase tables)
// ---------------------------------------------------------------------------

interface ExamRow {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// OCR response types (snake_case from AI)
// ---------------------------------------------------------------------------

interface RawOcrQuestion {
  number: number;
  content: string;
  type: string;
  options: string[] | null;
  answer: string | null;
  points: number | null;
  needs_review: boolean;
  ocr_confidence: number;
}

interface RawExamInfo {
  detected_subject: string;
  detected_grade: string | null;
  exam_type: string;
}

interface RawOcrResponse {
  questions: RawOcrQuestion[];
  metadata: {
    total_questions: number;
    page_number: number;
    confidence: number;
  };
  exam_info: RawExamInfo;
}

// ---------------------------------------------------------------------------
// OCR JSON Schema for OpenAI Structured Outputs
// ---------------------------------------------------------------------------

const OCR_QUESTIONS_SCHEMA = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          number: { type: "integer" as const, description: "문항 번호" },
          content: {
            type: "string" as const,
            description: "문항 본문 (LaTeX 수식은 $...$ 형식)",
          },
          type: {
            type: "string" as const,
            enum: ["multiple_choice", "short_answer", "essay"],
          },
          options: {
            anyOf: [
              { type: "array" as const, items: { type: "string" as const } },
              { type: "null" as const },
            ],
            description: "객관식 보기 배열 (주관식/서술형이면 null)",
          },
          answer: {
            anyOf: [
              { type: "string" as const },
              { type: "null" as const },
            ],
            description: "정답 (모르면 null)",
          },
          points: {
            anyOf: [
              { type: "integer" as const },
              { type: "null" as const },
            ],
            description: "배점 (모르면 null)",
          },
          needs_review: {
            type: "boolean" as const,
            description: "텍스트 불명확 시 true",
          },
          ocr_confidence: {
            type: "number" as const,
            description: "이 문항의 OCR 인식 정확도 (0.0~1.0)",
          },
        },
        required: [
          "number",
          "content",
          "type",
          "options",
          "answer",
          "points",
          "needs_review",
          "ocr_confidence",
        ],
        additionalProperties: false,
      },
    },
    metadata: {
      type: "object" as const,
      properties: {
        total_questions: { type: "integer" as const },
        page_number: { type: "integer" as const },
        confidence: { type: "number" as const },
      },
      required: ["total_questions", "page_number", "confidence"],
      additionalProperties: false,
    },
    exam_info: {
      type: "object" as const,
      properties: {
        detected_subject: {
          type: "string" as const,
          enum: ["math", "korean", "english", "other"],
          description: "시험지에서 자동 감지된 과목",
        },
        detected_grade: {
          anyOf: [{ type: "string" as const }, { type: "null" as const }],
          description: "시험지에서 감지된 학년 (예: 중1, 중2, 고1, 고2, 고3)",
        },
        exam_type: {
          type: "string" as const,
          enum: ["midterm_1", "midterm_2", "final_1", "final_2", "mock", "other"],
          description: "시험 유형",
        },
      },
      required: ["detected_subject", "detected_grade", "exam_type"] as const,
      additionalProperties: false,
    },
  },
  required: ["questions", "metadata", "exam_info"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// OCR system prompt (mirrored from OpenAIOcrGateway)
// ---------------------------------------------------------------------------

function buildOcrSystemPrompt(subject: string): string {
  const subjectLabel: Record<string, string> = {
    math: "수학",
    korean: "국어",
    english: "영어",
    other: "일반",
  };

  const label = subjectLabel[subject] ?? "일반";

  // 공통 규칙
  const commonRules = [
    '2. 객관식은 type="multiple_choice", 주관식은 type="short_answer", 서술형은 type="essay"로 분류하세요.',
    "3. 객관식 보기는 options 배열에 넣고, 주관식/서술형이면 options=null로 설정하세요.",
    "4. 정답이 시험지에 표시되어 있으면 answer 필드에 넣고, 없으면 null로 설정하세요.",
    "5. 배점이 표시되어 있으면 points 필드에 넣고, 없으면 null로 설정하세요.",
    "6. 텍스트가 불명확하거나 이미지가 잘려서 정확한 추출이 어려운 문항은 needs_review=true로 설정하세요.",
    "8. 시험지가 좌/우 2단 구성인 경우, 왼쪽 열부터 오른쪽 열 순서로 문항을 추출하세요.",
    "9. 이미지가 회전되거나 흐릿해도 최선을 다해 추출하고, 불확실한 부분은 needs_review=true로 표시하세요.",
    "10. 시험지의 과목, 학년, 시험 유형(중간/기말/모의)을 감지하여 exam_info에 포함하세요.",
  ];

  // 과목별 전용 규칙
  const subjectRules: Record<string, string[]> = {
    math: [
      "1. 수학 수식은 반드시 LaTeX 형태($...$)로 변환하세요.",
      "7. 이미지에 그림/그래프/도형이 포함된 경우, 본문에 `[Figure: 설명]` 형식으로 표시하고, 그림의 내용을 상세히 설명하세요.",
    ],
    korean: [
      "1. 지문(독서/문학)이 있는 경우, 지문 전체를 content에 포함하고 [지문] 태그로 구분하세요.",
      "7. 시(詩)는 행 구분을 유지하고, 작가와 제목을 포함하세요.",
      "11. <보기>가 있는 경우 content에 포함하세요.",
      "12. 지문 뒤 이어지는 연계 문항은 각각의 content에 지문 전체를 포함하세요.",
    ],
    english: [
      "1. 영어 지문이 있는 경우, 지문 전체를 content에 포함하고 [Passage] 태그로 구분하세요.",
      "7. 밑줄 친 부분은 __underlined text__ 형식으로 표시하세요.",
      "11. 빈칸은 _______ (빈칸) 형식으로 표시하세요.",
      "12. 지문 뒤 이어지는 연계 문항은 각각의 content에 지문 전체를 포함하세요.",
    ],
    other: [
      "1. 수식이 있으면 LaTeX 형태($...$)로 변환하세요.",
      "7. 이미지에 그림/그래프/도형이 포함된 경우, 본문에 `[Figure: 설명]` 형식으로 표시하세요.",
    ],
  };

  const rules = [...(subjectRules[subject] ?? subjectRules.other), ...commonRules];

  return [
    `당신은 한국 ${label} 시험지 OCR 전문가입니다.`,
    "주어진 시험지 이미지에서 모든 문항을 추출합니다.",
    "",
    "규칙:",
    ...rules,
  ].join("\n");
}

/**
 * 재시도용 강화 프롬프트 — 첫 OCR에서 0개 추출 시 사용
 */
function buildRetryOcrUserPrompt(subject: string): string {
  const subjectHints: Record<string, string> = {
    math: "수식, 그래프, 보기가 포함된 수학 문제를 찾으세요.",
    korean: "지문(독서/문학)과 이어지는 문항, <보기>를 찾으세요.",
    english: "영어 지문(Passage)과 이어지는 문항, 밑줄/빈칸을 찾으세요.",
    other: "시험 문항 형식의 모든 텍스트를 찾으세요.",
  };
  const hint = subjectHints[subject] ?? subjectHints.other;

  return [
    "이 시험지 이미지에서 모든 문항을 추출해주세요.",
    "",
    "주의: 이미지가 불명확하더라도 보이는 모든 텍스트를 최대한 추출하세요.",
    "부분적인 추출도 허용합니다. 문항 번호가 보이지 않으면 순서대로 번호를 매기세요.",
    `힌트: ${hint}`,
    "좌/우 2단 구성이거나 상/하 2페이지일 수 있으니 전체를 꼼꼼히 확인하세요.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Image download helper
// ---------------------------------------------------------------------------

async function downloadImageAsBase64(imageUrl: string): Promise<string> {
  // imageUrl은 Storage 경로 (예: "userId/filename.jpg")
  // supabaseAdmin을 통해 "exam-images" 버킷에서 서명된 URL 생성
  const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
    .storage.from("exam-images")
    .createSignedUrl(imageUrl, 300); // 5분 만료

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL: ${signedUrlError?.message ?? "unknown"}`,
    );
  }

  const response = await fetch(signedUrlData.signedUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download image: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  // ArrayBuffer → base64 변환 (Deno 환경)
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS 프리플라이트 처리
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
    const examId = body.examId;
    if (!examId || typeof examId !== "string") {
      return errorResponse("examId is required", 400, "VALIDATION_ERROR");
    }

    // --- 3. Load & validate exam ---
    const { data: exam, error: examErr } = await supabaseAdmin
      .from("exams")
      .select("id, user_id, subject, status, image_url")
      .eq("id", examId)
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

    // --- 4. Verify status transition (processing -> ocr_done) ---
    if (!canTransition(exam.status, "ocr_done")) {
      return errorResponse(
        `Cannot transition exam status from '${exam.status}' to 'ocr_done'`,
        400,
        "VALIDATION_ERROR",
      );
    }

    // --- 5. Validate image exists ---
    if (!exam.image_url) {
      return errorResponse(
        "Exam has no associated image",
        400,
        "VALIDATION_ERROR",
      );
    }

    // --- 6. Download image from Storage -> base64 ---
    let imageBase64: string;
    try {
      imageBase64 = await downloadImageAsBase64(exam.image_url);
    } catch (dlError: unknown) {
      console.error("[run-ocr] Image download failed:", dlError);
      await supabaseAdmin
        .from("exams")
        .update({ status: "error" })
        .eq("id", examId);
      const dlMessage =
        dlError instanceof Error ? dlError.message : "Image download failed";
      return errorResponse(dlMessage, 500, "IMAGE_DOWNLOAD_ERROR");
    }

    // --- 7. Call OpenAI GPT-4o-mini Vision for OCR ---
    const systemPrompt = buildOcrSystemPrompt(exam.subject);
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    let ocrResponse: RawOcrResponse;
    try {
      // OCR Vision API 호출 — 45초 타임아웃 + signal을 withRetry에 전달
      const response = await withTimeout(
        (signal) =>
          withRetry(
            () =>
              openai.chat.completions.create({
                model: OPENAI_MODEL,
                max_tokens: 8192,
                messages: [
                  { role: "system", content: systemPrompt },
                  {
                    role: "user",
                    content: [
                      {
                        type: "image_url",
                        image_url: { url: dataUrl, detail: "high" },
                      },
                      {
                        type: "text",
                        text: "이 시험지 이미지에서 모든 문항을 추출해주세요.",
                      },
                    ],
                  },
                ],
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: "ocr_questions",
                    strict: true,
                    schema: OCR_QUESTIONS_SCHEMA,
                  },
                },
                signal,
              }),
            3,
            1000,
            signal,
          ),
        45000,
        "OCR Vision API",
      );

      const rawText = response.choices[0]?.message?.content ?? "";
      const jsonStr = extractJson(rawText);
      ocrResponse = JSON.parse(jsonStr) as RawOcrResponse;
    } catch (aiError: unknown) {
      console.error("[run-ocr] OpenAI OCR failed:", aiError);
      await supabaseAdmin
        .from("exams")
        .update({ status: "error" })
        .eq("id", examId);

      const aiMessage =
        aiError instanceof Error ? aiError.message : "OCR processing failed";
      const aiStatus =
        (aiError as { status?: number })?.status ??
        (aiError as { statusCode?: number })?.statusCode ??
        503;
      return errorResponse(aiMessage, aiStatus, "OCR_FAILED");
    }

    // 최소 1개 문항 추출 여부 검증 — 0개이면 강화 프롬프트로 1회 재시도
    if (!ocrResponse.questions || ocrResponse.questions.length === 0) {
      console.warn("[run-ocr] First OCR pass returned 0 questions, retrying with enhanced prompt");

      try {
        const retryResponse = await withTimeout(
          (signal) =>
            withRetry(
              () =>
                openai.chat.completions.create({
                  model: OPENAI_MODEL,
                  max_tokens: 16384,
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: [
                        {
                          type: "image_url",
                          image_url: { url: dataUrl, detail: "high" },
                        },
                        {
                          type: "text",
                          text: buildRetryOcrUserPrompt(exam.subject),
                        },
                      ],
                    },
                  ],
                  response_format: {
                    type: "json_schema",
                    json_schema: {
                      name: "ocr_questions",
                      strict: true,
                      schema: OCR_QUESTIONS_SCHEMA,
                    },
                  },
                  signal,
                }),
              3,
              1000,
              signal,
            ),
          60000,
          "OCR Vision API (retry)",
        );

        const retryRawText = retryResponse.choices[0]?.message?.content ?? "";
        const retryJsonStr = extractJson(retryRawText);
        ocrResponse = JSON.parse(retryJsonStr) as RawOcrResponse;
      } catch (retryErr) {
        console.error("[run-ocr] OCR retry also failed:", retryErr);
        // 재시도도 실패 — 아래에서 0개 체크로 에러 반환
      }
    }

    if (!ocrResponse.questions || ocrResponse.questions.length === 0) {
      await supabaseAdmin
        .from("exams")
        .update({
          status: "error",
          ocr_result: {
            error: "OCR_NO_QUESTIONS",
            retried: true,
            confidence: ocrResponse?.metadata?.confidence ?? 0,
          },
        })
        .eq("id", examId);
      return errorResponse(
        "OCR failed to extract any questions from the image",
        422,
        "OCR_NO_QUESTIONS",
      );
    }

    // 중복 번호 해결 — 2단 구성 시험지에서 OCR이 같은 번호를 두 번 추출할 수 있음
    const seenNumbers = new Set<number>();
    let renumberNeeded = false;
    for (const q of ocrResponse.questions) {
      if (seenNumbers.has(q.number)) {
        renumberNeeded = true;
        break;
      }
      seenNumbers.add(q.number);
    }
    if (renumberNeeded) {
      ocrResponse.questions.forEach((q, i) => {
        q.number = i + 1;
      });
    }

    // --- 8. Save ocr_result on exam (camelCase for domain consistency) ---
    const ocrResult = {
      questions: ocrResponse.questions.map((q) => ({
        number: q.number,
        content: q.content,
        type: q.type,
        options: q.options,
        answer: q.answer,
        points: q.points,
        needsReview: q.needs_review,
        ocrConfidence: q.ocr_confidence,
      })),
      metadata: {
        totalQuestions: ocrResponse.metadata.total_questions,
        pageNumber: ocrResponse.metadata.page_number,
        confidence: ocrResponse.metadata.confidence,
      },
      examInfo: {
        detectedSubject: ocrResponse.exam_info.detected_subject,
        detectedGrade: ocrResponse.exam_info.detected_grade,
        examType: ocrResponse.exam_info.exam_type,
      },
    };

    const { error: ocrUpdateErr } = await supabaseAdmin
      .from("exams")
      .update({ ocr_result: ocrResult })
      .eq("id", examId);

    if (ocrUpdateErr) {
      console.error("[run-ocr] Failed to save ocr_result:", ocrUpdateErr);
      return errorResponse("Failed to save OCR result", 500, "DB_ERROR");
    }

    // --- 9. Insert questions into questions table ---
    const questionRows = ocrResponse.questions.map((q) => ({
      exam_id: examId,
      subject: exam.subject,
      number: q.number,
      content: q.content,
      question_type: q.type,
      options: q.options,
      answer: q.answer,
      student_answer: null,
      is_correct: null,
      points: q.points,
    }));

    const { data: savedQuestions, error: insertErr } = await supabaseAdmin
      .from("questions")
      .insert(questionRows)
      .select(
        "id, exam_id, number, content, question_type, options, answer, points",
      );

    if (insertErr) {
      console.error("[run-ocr] Failed to insert questions:", insertErr);
      // 부분 삽입된 행 정리
      await supabaseAdmin
        .from("questions")
        .delete()
        .eq("exam_id", examId);
      await supabaseAdmin
        .from("exams")
        .update({ status: "error" })
        .eq("id", examId);
      return errorResponse(`Failed to save questions: ${insertErr.message}`, 500, "DB_ERROR");
    }

    // --- 10. Update exam status -> 'ocr_done' ---
    const { error: statusErr } = await supabaseAdmin
      .from("exams")
      .update({ status: "ocr_done" })
      .eq("id", examId);

    if (statusErr) {
      console.error("[run-ocr] Failed to update exam status:", statusErr);
      return errorResponse(
        "Failed to update exam status",
        500,
        "DB_ERROR",
      );
    }

    // --- 11. Map to camelCase response ---
    const mappedQuestions = (savedQuestions ?? []).map(
      (q: Record<string, unknown>) => ({
        id: q.id,
        examId: q.exam_id,
        number: q.number,
        content: q.content,
        questionType: q.question_type,
        options: q.options,
        answer: q.answer,
        points: q.points,
      }),
    );

    const needsReviewCount = ocrResponse.questions.filter(
      (q) => q.needs_review,
    ).length;

    return jsonResponse({
      examId,
      status: "ocr_done",
      questions: mappedQuestions,
      ocrMetadata: ocrResult.metadata,
      examInfo: ocrResult.examInfo,
      needsReviewCount,
    });
  } catch (error: unknown) {
    console.error("[run-ocr] Unhandled error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      (error as { statusCode?: number })?.statusCode ??
      (error as { status?: number })?.status ??
      500;

    return errorResponse(message, status, "INTERNAL_ERROR");
  }
});
