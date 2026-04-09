/**
 * analyze-exam Edge Function
 *
 * Orchestrates the full L2 + L3 + L4 analysis pipeline for a verified exam.
 * Mirrors AnalyzeExamUseCase logic but runs in Deno with direct DB + AI calls.
 *
 * Pipeline:
 *  1. Auth + validation (ownership, status, expiry)
 *  2. Credit pre-check
 *  3. Cache lookup (question_cache) — 캐시 히트 시 AI 호출 생략
 *  4. L2: Classification (GPT-4o-mini) + Blueprint generation
 *  5. L3: Diagnosis (Claude Sonnet, GPT-4o fallback) + Verification (GPT-4o-mini) in parallel
 *  6. L4: Variant generation (Claude Sonnet) + L4b variant answer verification
 *  7. Credit deduction (캐시 히트 제외) + status update -> "analyzed"
 *
 * Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

import OpenAI from "npm:openai";
import Anthropic from "npm:@anthropic-ai/sdk";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getUserId } from "../_shared/auth.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { withTimeout } from "../_shared/timeout.ts";
import { createLimiter } from "../_shared/concurrency.ts";
import { extractJson } from "../_shared/extractJson.ts";
import { withRetry } from "../_shared/retry.ts";
import { canTransition, isExpired } from "../_shared/statusTransitions.ts";
import {
  VARIANT_SYSTEM,
  buildVariantSystem,
  VariantRaw,
  parseVisualExplanation,
} from "../_shared/variantTypes.ts";
import { computeContentHash } from "../_shared/contentHash.ts";

// ---------------------------------------------------------------------------
// SDK clients (initialized once per cold start)
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLASSIFICATION_BATCH_SIZE = 5;
const DEFAULT_VARIANT_COUNT = 3;
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_MODEL_LARGE = "gpt-4o";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// 진단 병렬 처리 동시 제한 — AI API 과부하 방지
const diagnosisLimiter = createLimiter(5);

// ---------------------------------------------------------------------------
// DB Row types (snake_case, matching Supabase tables)
// ---------------------------------------------------------------------------

interface ExamRow {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  expires_at: string;
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
  points: number | null;
}

interface CreditRow {
  id: string;
  user_id: string;
  total: number;
  used: number;
}

interface UserRow {
  id: string;
  grade: string | null;
}

// ---------------------------------------------------------------------------
// Cache row type (question_cache 테이블)
// ---------------------------------------------------------------------------

interface QuestionCacheRow {
  content_hash: string;
  classification: ClassificationResult | null;
  explanation: ExplanationResult | null;
}

// ---------------------------------------------------------------------------
// L2: Classification result type
// ---------------------------------------------------------------------------

interface ClassificationResult {
  questionId: string;
  subject: string;
  unit: string;
  subUnit: string;
  difficulty: string;
  questionType: string;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// L2: Classification (GPT-4o-mini)
// ---------------------------------------------------------------------------

function buildClassifySystem(subject: string): string {
  // 과목별 단원 예시
  const unitExamples: Record<string, string> = {
    math: '예: "이차함수", "확률과 통계", "도형의 성질", "수열", "미분과 적분"',
    korean: '예: "독서(비문학)", "문학(현대시)", "문학(현대소설)", "문학(고전)", "화법과 작문", "언어와 매체"',
    english: '예: "독해(주제/요지)", "독해(빈칸추론)", "독해(순서배열)", "독해(문장삽입)", "어법", "어휘"',
  };
  const unitExample = unitExamples[subject] ?? unitExamples.math;

  return [
    "당신은 한국 중고등학교 교육과정 분류 전문가입니다.",
    "주어진 시험 문항들을 분석하여 교육과정 단원, 난이도, 문항 유형을 분류합니다.",
    "",
    "규칙:",
    '1. subject: 과목 (math, korean, english 중 하나)',
    `2. unit: 대단원명 (${unitExample})`,
    '3. sub_unit: 소단원명',
    "4. difficulty: easy/medium/hard",
    "5. question_type: multiple_choice/short_answer/essay",
    "6. reasoning: 분류 근거를 한국어로 간결하게 설명",
    "",
    "입력된 모든 문항에 대해 각각 분류하여, results 배열로 응답하세요.",
    "반드시 JSON만 출력하세요.",
  ].join("\n");
}

// 하위 호환성 — 기존 코드에서 상수로 참조하는 경우
const CLASSIFY_SYSTEM = buildClassifySystem("math");

const CLASSIFY_BATCH_SCHEMA = {
  type: "object" as const,
  properties: {
    results: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          question_id: { type: "string" as const },
          subject: {
            type: "string" as const,
            enum: ["math", "korean", "english"],
          },
          unit: { type: "string" as const },
          sub_unit: { type: "string" as const },
          difficulty: {
            type: "string" as const,
            enum: ["easy", "medium", "hard"],
          },
          question_type: {
            type: "string" as const,
            enum: ["multiple_choice", "short_answer", "essay"],
          },
          reasoning: { type: "string" as const },
        },
        required: [
          "question_id",
          "subject",
          "unit",
          "sub_unit",
          "difficulty",
          "question_type",
          "reasoning",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

async function classifyBatch(
  questions: QuestionRow[],
  grade: string,
): Promise<ClassificationResult[]> {
  if (questions.length === 0) return [];

  const lines: string[] = [];
  lines.push("## 공통 정보");
  lines.push(`- 과목: ${questions[0]?.subject ?? "math"}`);
  lines.push(`- 학년: ${grade}`);
  lines.push(`- 총 문항 수: ${questions.length}`);
  lines.push("");

  for (const q of questions) {
    lines.push("---");
    lines.push(`### 문항 ${q.number} (ID: ${q.id})`);
    lines.push(q.content);
    if (q.options) {
      lines.push("보기:");
      q.options.forEach((opt: string, i: number) => {
        lines.push(`  ${i + 1}. ${opt}`);
      });
    }
    lines.push("");
  }

  lines.push("위 모든 문항을 각각 분류하여 results 배열로 응답하세요.");

  // 과목별 분류 프롬프트 사용
  const classifySystem = buildClassifySystem(questions[0]?.subject ?? "math");

  // 분류 API 호출 — 30초 타임아웃 + signal 전달
  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          openai.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: 4096,
            messages: [
              { role: "system", content: classifySystem },
              { role: "user", content: lines.join("\n") },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "batch_classification",
                strict: true,
                schema: CLASSIFY_BATCH_SCHEMA,
              },
            },
            signal,
          }),
        3,
        1000,
        signal,
      ),
    30000,
    "Classification API",
  );

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(rawText)) as {
    results: {
      question_id: string;
      subject: string;
      unit: string;
      sub_unit: string;
      difficulty: string;
      question_type: string;
      reasoning: string;
    }[];
  };

  return parsed.results.map((r) => ({
    questionId: r.question_id,
    subject: r.subject,
    unit: r.unit,
    subUnit: r.sub_unit,
    difficulty: r.difficulty,
    questionType: r.question_type,
    reasoning: r.reasoning,
  }));
}

// ---------------------------------------------------------------------------
// Blueprint generation (pure aggregation, no AI)
// ---------------------------------------------------------------------------

function generateBlueprintData(classifications: ClassificationResult[]) {
  const total = classifications.length;
  if (total === 0) {
    return {
      unitDistribution: {} as Record<string, number>,
      typeDistribution: {} as Record<string, number>,
      difficultyDistribution: {} as Record<string, number>,
      insights: null as string[] | null,
    };
  }

  const unitCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};

  for (const c of classifications) {
    unitCounts[c.unit] = (unitCounts[c.unit] ?? 0) + 1;
    typeCounts[c.questionType] = (typeCounts[c.questionType] ?? 0) + 1;
    difficultyCounts[c.difficulty] = (difficultyCounts[c.difficulty] ?? 0) + 1;
  }

  const toRatio = (counts: Record<string, number>) => {
    const result: Record<string, number> = {};
    for (const [key, count] of Object.entries(counts)) {
      result[key] = Math.round((count / total) * 100) / 100;
    }
    return result;
  };

  const unitDistribution = toRatio(unitCounts);
  const typeDistribution = toRatio(typeCounts);
  const difficultyDistribution = toRatio(difficultyCounts);

  const insights: string[] = [];
  const topUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0];
  if (topUnit) {
    insights.push(
      `가장 많이 출제된 단원은 "${topUnit[0]}"입니다 (${topUnit[1]}/${total}문항).`,
    );
  }
  const hardCount = difficultyCounts["hard"] ?? 0;
  if (hardCount > 0) {
    insights.push(`고난도 문항이 ${hardCount}개 포함되어 있습니다.`);
  }
  const easyRatio = difficultyDistribution["easy"] ?? 0;
  const hardRatio = difficultyDistribution["hard"] ?? 0;
  if (easyRatio > 0.5) {
    insights.push("전체적으로 쉬운 난이도의 시험입니다.");
  } else if (hardRatio > 0.4) {
    insights.push("전체적으로 어려운 난이도의 시험입니다.");
  } else {
    insights.push("난이도가 균형 있게 분포되어 있습니다.");
  }

  return { unitDistribution, typeDistribution, difficultyDistribution, insights };
}

// ---------------------------------------------------------------------------
// L3a: Explanation / Diagnosis (Anthropic Claude Sonnet)
// ---------------------------------------------------------------------------

function buildExplanationSystem(subject: string): string {
// 과목별 진단 가이드
const subjectGuidance: Record<string, string> = {
  math: "",
  korean: "\n국어 과목은 지문 이해도, 문법 규칙 적용, 어휘력, 작품 해석력을 중점적으로 진단하세요.",
  english: "\n영어 과목은 문법 구조, 어휘 수준, 독해 전략, 시간 관리를 중점적으로 진단하세요.",
};
const extra = subjectGuidance[subject] ?? "";

return [
  "당신은 한국 수학/국어/영어 시험 전문 선생님입니다.",
  "학생의 오답을 분석하고, 단계별 풀이와 교정 안내를 제공합니다.",
  "",
  "규칙:",
  "1. error_type: concept_gap / calculation_error / time_pressure / comprehension_error / grammar_error / vocabulary_gap / interpretation_error",
  "2. confidence: 0.0~1.0",
  "3. correct_answer: 정답 (LaTeX)",
  "4. step_by_step: 단계별 풀이를 '1단계: [개념] 내용' 형식으로 작성하세요. (LaTeX 포함)",
  "5. error_reasoning: 오답 원인 (한국어)",
  "6. correction_guidance: 교정 안내 (한국어)",
  "7. specific_mistake: 학생이 구체적으로 어떤 실수를 했는지 명시하세요 (한국어)",
    extra,
    "",
    "visual_explanation 도식을 반드시 포함하세요:",
    "- concept_gap → flow 유형: { type: 'flow', data: { nodes: [{id, type, label, latex, status}], edges: [{from, to, label}], error_node_id, summary, concept_keywords, student_steps: null, correct_steps: null, diverge_index: null, lines: null, error_line_index: null } }",
    "- calculation_error → comparison 유형: { type: 'comparison', data: { student_steps: [{label, latex, status, annotation}], correct_steps: [...], diverge_index, summary, concept_keywords, nodes: null, edges: null, error_node_id: null, lines: null, error_line_index: null } }",
    "- time_pressure → formula 유형: { type: 'formula', data: { lines: [{latex, annotation, is_error}], error_line_index, summary, concept_keywords, nodes: null, edges: null, error_node_id: null, student_steps: null, correct_steps: null, diverge_index: null } }",
    "- 국어/영어 과목은 flow 또는 comparison 중 가장 적합한 type을 선택하세요 (formula는 수학 전용)",
    "- data 객체의 모든 필드를 포함하되, 사용하지 않는 필드는 null",
    "",
    "반드시 JSON만 응답하세요 (마크다운 코드펜스 허용).",
  ].join("\n");
}

const EXPLANATION_SYSTEM = buildExplanationSystem("math");

interface ExplanationResult {
  errorType: string;
  confidence: number;
  correctAnswer: string;
  stepByStep: string;
  errorReasoning: string;
  correctionGuidance: string;
  specificMistake: string;
  visualExplanation: { type: string; data: Record<string, unknown> } | null;
}

async function diagnoseQuestion(
  question: QuestionRow,
  classification: ClassificationResult,
  grade: string,
): Promise<ExplanationResult> {
  const lines: string[] = [];
  lines.push("## 문제 정보");
  lines.push(`- 과목: ${question.subject}`);
  lines.push(`- 학년: ${grade}`);
  lines.push(`- 단원: ${classification.unit} > ${classification.subUnit}`);
  lines.push(`- 난이도: ${classification.difficulty}`);
  lines.push(`- 문제 유형: ${classification.questionType}`);
  lines.push("");
  lines.push("## 문제 내용");
  lines.push(question.content);
  if (question.options) {
    lines.push("");
    lines.push("## 보기");
    question.options.forEach((opt: string, i: number) => {
      lines.push(`${i + 1}. ${opt}`);
    });
  }
  lines.push("");
  lines.push(`## 정답: ${question.answer ?? "(제공되지 않음)"}`);
  lines.push(`## 학생 답: ${question.student_answer ?? "(없음)"}`);
  lines.push("");
  lines.push("위 정보를 바탕으로 오답 원인을 분석하고 JSON으로 응답하세요.");
  lines.push(
    "필드: error_type, confidence, correct_answer, step_by_step, error_reasoning, correction_guidance, specific_mistake, visual_explanation",
  );

  // 과목별 진단 프롬프트 사용
  const explanationSystem = buildExplanationSystem(question.subject);

  // 진단/설명 API 호출 — 45초 타임아웃 + signal 전달
  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: explanationSystem,
            messages: [{ role: "user", content: lines.join("\n") }],
            signal,
          }),
        3,
        1000,
        signal,
      ),
    45000,
    "Diagnosis/Explanation API",
  );

  const rawText = response.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text: string }) => b.text)
    .join("");

  const parsed = JSON.parse(extractJson(rawText));

  return {
    errorType: parsed.error_type ?? "concept_gap",
    confidence: Number(parsed.confidence ?? 0.5),
    correctAnswer: String(parsed.correct_answer ?? ""),
    stepByStep: String(parsed.step_by_step ?? ""),
    errorReasoning: String(parsed.error_reasoning ?? ""),
    correctionGuidance: String(parsed.correction_guidance ?? ""),
    specificMistake: String(parsed.specific_mistake ?? ""),
    visualExplanation: parseVisualExplanation(parsed.visual_explanation),
  };
}

// ---------------------------------------------------------------------------
// L3a fallback: GPT-4o 기반 진단 — Claude 실패 시 대체
// ---------------------------------------------------------------------------

async function diagnoseQuestionGPT(
  question: QuestionRow,
  classification: ClassificationResult,
  grade: string,
): Promise<ExplanationResult> {
  const lines: string[] = [];
  lines.push("## 문제 정보");
  lines.push(`- 과목: ${question.subject}`);
  lines.push(`- 학년: ${grade}`);
  lines.push(`- 단원: ${classification.unit} > ${classification.subUnit}`);
  lines.push(`- 난이도: ${classification.difficulty}`);
  lines.push(`- 문제 유형: ${classification.questionType}`);
  lines.push("");
  lines.push("## 문제 내용");
  lines.push(question.content);
  if (question.options) {
    lines.push("");
    lines.push("## 보기");
    question.options.forEach((opt: string, i: number) => {
      lines.push(`${i + 1}. ${opt}`);
    });
  }
  lines.push("");
  lines.push(`## 정답: ${question.answer ?? "(제공되지 않음)"}`);
  lines.push(`## 학생 답: ${question.student_answer ?? "(없음)"}`);
  lines.push("");
  lines.push("위 정보를 바탕으로 오답 원인을 분석하고 JSON으로 응답하세요.");
  lines.push(
    "필드: error_type, confidence, correct_answer, step_by_step, error_reasoning, correction_guidance, specific_mistake, visual_explanation",
  );

  const GPT_DIAGNOSIS_SCHEMA = {
    type: "object" as const,
    properties: {
      error_type: { type: "string" as const },
      confidence: { type: "number" as const },
      correct_answer: { type: "string" as const },
      step_by_step: { type: "string" as const },
      error_reasoning: { type: "string" as const },
      correction_guidance: { type: "string" as const },
      specific_mistake: { type: "string" as const },
      visual_explanation: {
        type: ["object", "null"] as unknown as "object",
      },
    },
    required: [
      "error_type",
      "confidence",
      "correct_answer",
      "step_by_step",
      "error_reasoning",
      "correction_guidance",
      "specific_mistake",
    ],
    additionalProperties: false,
  };

  // 과목별 진단 프롬프트 사용 (GPT fallback)
  const explanationSystem = buildExplanationSystem(question.subject);

  // GPT-4o 진단 호출 — 45초 타임아웃 + signal 전달
  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          openai.chat.completions.create({
            model: OPENAI_MODEL_LARGE,
            max_tokens: 4096,
            messages: [
              { role: "system", content: explanationSystem },
              { role: "user", content: lines.join("\n") },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "diagnosis",
                strict: false,
                schema: GPT_DIAGNOSIS_SCHEMA,
              },
            },
            signal,
          }),
        3,
        1000,
        signal,
      ),
    45000,
    "Diagnosis/Explanation API (GPT fallback)",
  );

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(rawText));

  return {
    errorType: parsed.error_type ?? "concept_gap",
    confidence: Number(parsed.confidence ?? 0.5),
    correctAnswer: String(parsed.correct_answer ?? ""),
    stepByStep: String(parsed.step_by_step ?? ""),
    errorReasoning: String(parsed.error_reasoning ?? ""),
    correctionGuidance: String(parsed.correction_guidance ?? ""),
    specificMistake: String(parsed.specific_mistake ?? ""),
    visualExplanation: parseVisualExplanation(parsed.visual_explanation),
  };
}

// ---------------------------------------------------------------------------
// L3a with fallback: Claude → GPT-4o
// ---------------------------------------------------------------------------

async function diagnoseQuestionWithFallback(
  question: QuestionRow,
  classification: ClassificationResult,
  grade: string,
): Promise<ExplanationResult> {
  try {
    return await diagnoseQuestion(question, classification, grade);
  } catch (claudeErr) {
    console.warn("[analyze-exam] Claude L3 failed, falling back to GPT-4o:", claudeErr);
    return await diagnoseQuestionGPT(question, classification, grade);
  }
}

// ---------------------------------------------------------------------------
// L3b: Verification (OpenAI GPT-4o-mini)
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
  required: ["answer", "brief_solution"],
  additionalProperties: false,
};

async function verifyQuestion(
  question: QuestionRow,
): Promise<{ answer: string; briefSolution: string }> {
  const lines: string[] = [];
  lines.push("## 문제 정보");
  lines.push(`- 과목: ${question.subject}`);
  lines.push(`- 문항 번호: ${question.number}`);
  lines.push(`- 유형: ${question.question_type}`);
  lines.push("");
  lines.push("## 문제 내용");
  lines.push(question.content);
  if (question.options) {
    lines.push("");
    lines.push("## 보기");
    question.options.forEach((opt: string, i: number) => {
      lines.push(`${i + 1}. ${opt}`);
    });
  }
  lines.push("");
  lines.push("이 문제를 독립적으로 풀어서 정답과 풀이를 제공해주세요.");

  // 검증 API 호출 — 30초 타임아웃 + signal 전달
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
    "Verification API",
  );

  const rawText = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(rawText));

  return {
    answer: String(parsed.answer ?? ""),
    briefSolution: String(parsed.brief_solution ?? ""),
  };
}

// ---------------------------------------------------------------------------
// L4: Variant Generation (Anthropic Claude Sonnet)
// ---------------------------------------------------------------------------

async function generateVariantsAI(
  diagnosis: {
    error_type: string;
    reasoning: string;
    correction: string;
  },
  question: QuestionRow,
  count: number,
  grade: string,
): Promise<VariantRaw[]> {
  const optionsText = question.options
    ? "\n보기:\n" +
      question.options
        .map((o: string, i: number) => `${i + 1}. ${o}`)
        .join("\n")
    : "";

  const lines: string[] = [];
  lines.push("## 오답 진단 결과");
  lines.push(`- 오답 유형: ${diagnosis.error_type}`);
  lines.push(`- 원인 분석: ${diagnosis.reasoning}`);
  lines.push(`- 교정 안내: ${diagnosis.correction}`);
  lines.push("");
  lines.push("## 원본 문제");
  lines.push(`- 학년: ${grade}`);
  lines.push(`- 과목: ${question.subject}`);
  lines.push(question.content);
  if (optionsText) lines.push(optionsText);
  if (question.answer) lines.push(`정답: ${question.answer}`);
  lines.push("");
  lines.push("## 요청");
  lines.push(
    `위 진단 결과를 바탕으로 약점 교정용 변형문항 ${count}개를 생성하세요.`,
  );

  // 과목/학년별 변형문항 프롬프트 생성
  const variantSystem = buildVariantSystem(question.subject, grade);

  // 변형문항 생성 API 호출 — 45초 타임아웃 + signal 전달
  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          anthropic.messages.create({
            model: ANTHROPIC_MODEL,
            max_tokens: 4096,
            system: variantSystem,
            messages: [{ role: "user", content: lines.join("\n") }],
            signal,
          }),
        3,
        1000,
        signal,
      ),
    45000,
    "Variant Generation API (analyze-exam)",
  );

  const rawText = response.content
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { type: string; text: string }) => b.text)
    .join("");

  const parsed = JSON.parse(extractJson(rawText)) as {
    variants: VariantRaw[];
  };
  return parsed.variants ?? [];
}

// ---------------------------------------------------------------------------
// L4b: Variant answer verification (GPT-4o-mini)
// ---------------------------------------------------------------------------

const VARIANT_VERIFY_SYSTEM = [
  "당신은 한국 시험 정답 검증 전문가입니다.",
  "주어진 변형문항을 독립적으로 풀어서 정답을 검증합니다.",
  "",
  "규칙:",
  "1. 문제를 처음부터 직접 풀어주세요.",
  "2. 수학 수식은 LaTeX 형태($...$)로 작성하세요.",
  "3. brief_solution은 핵심 풀이 과정만 간결하게 작성하세요 (3-5줄).",
  "4. 객관식이면 answer에 번호를, 주관식이면 답 자체를 적어주세요.",
  "",
  "반드시 JSON만 응답하세요.",
].join("\n");

async function verifyVariantAnswer(
  variant: { id: string; content: string; question_type: string; options: string[] | null; answer: string },
): Promise<{ variantId: string; verifierAnswer: string; briefSolution: string; match: boolean }> {
  const lines: string[] = [];
  lines.push("## 변형문항");
  lines.push(`- 유형: ${variant.question_type}`);
  lines.push("");
  lines.push("## 문제 내용");
  lines.push(variant.content);
  if (variant.options) {
    lines.push("");
    lines.push("## 보기");
    variant.options.forEach((opt: string, i: number) => {
      lines.push(`${i + 1}. ${opt}`);
    });
  }
  lines.push("");
  lines.push("이 문제를 독립적으로 풀어서 정답과 풀이를 제공해주세요.");

  // 변형문항 검증 — 30초 타임아웃 + signal 전달
  const response = await withTimeout(
    (signal) =>
      withRetry(
        () =>
          openai.chat.completions.create({
            model: OPENAI_MODEL,
            max_tokens: 1024,
            messages: [
              { role: "system", content: VARIANT_VERIFY_SYSTEM },
              { role: "user", content: lines.join("\n") },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "variant_verification",
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

  const verifierAnswer = String(parsed.answer ?? "");
  const briefSolution = String(parsed.brief_solution ?? "");

  // 정답 일치 여부 비교 — 공백·대소문자 정규화
  const normalizedOriginal = variant.answer.replace(/\s+/g, "").toLowerCase();
  const normalizedVerifier = verifierAnswer.replace(/\s+/g, "").toLowerCase();
  const match = normalizedOriginal === normalizedVerifier;

  return { variantId: variant.id, verifierAnswer, briefSolution, match };
}

// ---------------------------------------------------------------------------
// Confidence determination (mirrored from domain/rules/errorTypeDetection)
// ---------------------------------------------------------------------------

function determineConfidence(
  primaryAnswer: string,
  verifierAnswer: string,
  baseConfidence: number,
): number {
  const n1 = primaryAnswer.replace(/\s+/g, "").toLowerCase();
  const n2 = verifierAnswer.replace(/\s+/g, "").toLowerCase();
  const match = n1 === n2;
  const safe = Math.max(
    0,
    Math.min(1, baseConfidence > 1 ? baseConfidence / 100 : baseConfidence),
  );
  return match ? safe : Math.min(safe, 0.5);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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
      .select("id, user_id, subject, status, expires_at")
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

    // MVP: verify 단계를 건너뛰고 ocr_done에서 바로 분석 시작 허용
    // ocr_done → (자동 verified) → analyzed 전이를 한 번에 처리한다.
    let currentStatus = exam.status;

    // error 상태에서 재시도: verified로 되돌린다
    if (currentStatus === "error") {
      await supabaseAdmin
        .from("exams")
        .update({ status: "verified" })
        .eq("id", examId);
      currentStatus = "verified";
    }

    // ocr_done 상태: 자동으로 verified로 전이 (MVP에서 수동 검증 생략)
    if (currentStatus === "ocr_done") {
      await supabaseAdmin
        .from("exams")
        .update({ status: "verified" })
        .eq("id", examId);
      currentStatus = "verified";
    }

    if (!canTransition(currentStatus, "analyzed")) {
      return errorResponse(
        `Cannot transition exam status from '${currentStatus}' to 'analyzed'`,
        400,
        "VALIDATION_ERROR",
      );
    }

    if (isExpired(exam.expires_at)) {
      return errorResponse("Exam has expired", 410, "EXPIRED");
    }

    // --- 4. Load questions ---
    const { data: allQuestions, error: qErr } = await supabaseAdmin
      .from("questions")
      .select("*")
      .eq("exam_id", examId)
      .order("number", { ascending: true });

    if (qErr || !allQuestions) {
      return errorResponse("Failed to load questions", 500, "DB_ERROR");
    }

    const questions = allQuestions as QuestionRow[];
    const wrongQuestions = questions.filter((q) => q.is_correct !== true);
    const wrongCount = wrongQuestions.length;

    // --- 5. Cache lookup (question_cache) ---
    // 문제 내용 해시를 계산하고 캐시된 결과 조회
    const hashMap = new Map<string, string>(); // questionId → contentHash
    const cacheMap = new Map<string, QuestionCacheRow>(); // contentHash → cached row
    let cacheHits = 0;

    // 해시 계산 (전체 문항)
    await Promise.all(
      questions.map(async (q) => {
        const hash = await computeContentHash(q.content);
        hashMap.set(q.id, hash);
      }),
    );

    // 캐시 조회 — 해시 기반
    const allHashes = [...new Set(hashMap.values())];
    if (allHashes.length > 0) {
      const { data: cachedRows } = await supabaseAdmin
        .from("question_cache")
        .select("content_hash, classification, explanation")
        .in("content_hash", allHashes);

      if (cachedRows) {
        for (const row of cachedRows as QuestionCacheRow[]) {
          cacheMap.set(row.content_hash, row);
        }
      }
    }

    // --- 6. Credit pre-check ---
    // 캐시 히트된 오답은 크레딧 차감 대상에서 제외
    const wrongHashHits = wrongQuestions.filter((q) => {
      const hash = hashMap.get(q.id);
      if (!hash) return false;
      const cached = cacheMap.get(hash);
      return cached?.explanation != null;
    }).length;
    cacheHits = wrongHashHits;

    const { data: credit, error: creditErr } = await supabaseAdmin
      .from("credits")
      .select("id, user_id, total, used")
      .eq("user_id", userId)
      .single<CreditRow>();

    if (creditErr || !credit) {
      return errorResponse("Credit record not found", 404, "NOT_FOUND");
    }

    const remaining = credit.total - credit.used;
    const chargeableWrongCount = Math.max(0, wrongCount - cacheHits);
    if (remaining < chargeableWrongCount) {
      return errorResponse(
        `Insufficient credits: need ${chargeableWrongCount}, have ${remaining}`,
        402,
        "INSUFFICIENT_CREDITS",
      );
    }

    // --- 7. Get user grade ---
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id, grade")
      .eq("id", userId)
      .single<UserRow>();

    const grade = userRow?.grade ?? "high1";

    // --- 8. L2: Classification (parallel batches) ---
    // 캐시된 분류 결과가 있으면 AI 호출 생략
    const questionsToClassify: QuestionRow[] = [];
    const cachedClassifications: ClassificationResult[] = [];

    for (const q of questions) {
      const hash = hashMap.get(q.id);
      const cached = hash ? cacheMap.get(hash) : undefined;
      if (cached?.classification) {
        // 캐시된 분류 결과 사용 — questionId만 현재 문항에 맞게 교체
        cachedClassifications.push({
          ...cached.classification,
          questionId: q.id,
        });
      } else {
        questionsToClassify.push(q);
      }
    }

    // 분류 대상 문항을 배치 단위로 병렬 처리
    const classificationLimiter = createLimiter(3);
    const batchPromises: Promise<ClassificationResult[]>[] = [];
    for (let i = 0; i < questionsToClassify.length; i += CLASSIFICATION_BATCH_SIZE) {
      const batch = questionsToClassify.slice(i, i + CLASSIFICATION_BATCH_SIZE);
      batchPromises.push(classificationLimiter(() => classifyBatch(batch, grade)));
    }
    const batchResults = await Promise.all(batchPromises);
    const newClassifications = batchResults.flat();

    // 캐시된 결과와 신규 결과를 합침
    const allClassifications = [...cachedClassifications, ...newClassifications];

    // --- 9. L2: Blueprint generation + save ---
    const blueprintData = generateBlueprintData(allClassifications);

    // Upsert: 기존 blueprint 확인 후 멱등성 보장
    const { data: existingBp } = await supabaseAdmin
      .from("blueprints")
      .select("id")
      .eq("exam_id", examId)
      .single();

    let blueprintId: string;
    if (existingBp) {
      blueprintId = existingBp.id;
      await supabaseAdmin
        .from("blueprints")
        .update({
          unit_distribution: blueprintData.unitDistribution,
          type_distribution: blueprintData.typeDistribution,
          difficulty_distribution: blueprintData.difficultyDistribution,
          insights: blueprintData.insights,
        })
        .eq("id", blueprintId);
    } else {
      const { data: newBp, error: bpErr } = await supabaseAdmin
        .from("blueprints")
        .insert({
          exam_id: examId,
          unit_distribution: blueprintData.unitDistribution,
          type_distribution: blueprintData.typeDistribution,
          difficulty_distribution: blueprintData.difficultyDistribution,
          insights: blueprintData.insights,
        })
        .select("id")
        .single();

      if (bpErr || !newBp) {
        console.error("[analyze-exam] Blueprint insert error:", bpErr);
        return errorResponse("Failed to save blueprint", 500, "DB_ERROR");
      }
      blueprintId = newBp.id;
    }

    // --- 10. Build classification map ---
    const classificationMap = new Map<string, ClassificationResult>();
    for (const c of allClassifications) {
      classificationMap.set(c.questionId, c);
    }

    // --- 11. Idempotency check: 이미 진단된 문항 확인 ---
    const { data: existingDiagnoses } = await supabaseAdmin
      .from("error_diagnoses")
      .select("id, question_id, error_type, confidence, reasoning, correction, step_by_step, verification_result, created_at")
      .in("question_id", wrongQuestions.map((q) => q.id));

    const alreadyDiagnosedIds = new Set(
      (existingDiagnoses ?? []).map((d: { question_id: string }) => d.question_id),
    );

    // 이미 진단된 결과를 diagnosisEntries에 미리 수집
    const diagnosisEntries: {
      diagnosis: Record<string, unknown>;
      question: QuestionRow;
    }[] = [];

    for (const d of existingDiagnoses ?? []) {
      const question = wrongQuestions.find((q) => q.id === (d as Record<string, unknown>).question_id);
      if (question) {
        diagnosisEntries.push({ diagnosis: d as Record<string, unknown>, question });
      }
    }

    // 진단이 아직 안 된 오답 문항만 필터
    const questionsToDiagnose = wrongQuestions.filter(
      (q) => !alreadyDiagnosedIds.has(q.id),
    );

    // --- 12. L3: Diagnosis + Verification (parallel per wrong question) ---
    // 오답 진단 병렬 실행 — 캐시된 explanation은 재사용, 나머지는 AI 호출
    const diagnosisResults = await Promise.allSettled(
      questionsToDiagnose.map((question) =>
        diagnosisLimiter(async () => {
          const classification = classificationMap.get(question.id);
          if (!classification) {
            throw new Error(
              `No classification found for question ${question.id}`,
            );
          }

          // 캐시된 explanation이 있으면 AI 진단 생략 (verification은 항상 신규 실행)
          const hash = hashMap.get(question.id);
          const cached = hash ? cacheMap.get(hash) : undefined;
          let explanation: ExplanationResult;

          if (cached?.explanation) {
            // 캐시 히트 — 설명은 캐시에서, questionId만 교체
            explanation = cached.explanation;
          } else {
            // 캐시 미스 — Claude (fallback: GPT-4o)로 진단
            explanation = await diagnoseQuestionWithFallback(
              question,
              classification,
              grade,
            );
          }

          // L3b verification은 항상 새로 실행 — 정답 교차 검증용
          const verification = await verifyQuestion(question);

          // Determine confidence
          const confidence = determineConfidence(
            explanation.correctAnswer,
            verification.answer,
            explanation.confidence,
          );

          const verificationResult = {
            verified: true,
            verifier_answer: verification.answer,
            match:
              explanation.correctAnswer.replace(/\s+/g, "").toLowerCase() ===
              verification.answer.replace(/\s+/g, "").toLowerCase(),
          };

          // OCR이 정답을 추출하지 못한 경우 보충
          if (!question.answer && explanation.correctAnswer) {
            await supabaseAdmin
              .from("questions")
              .update({ answer: explanation.correctAnswer })
              .eq("id", question.id);
          }

          // Save diagnosis
          const { data: diagnosisRow, error: diagErr } = await supabaseAdmin
            .from("error_diagnoses")
            .insert({
              question_id: question.id,
              error_type: explanation.errorType,
              confidence,
              reasoning: explanation.errorReasoning,
              correction: explanation.correctionGuidance,
              step_by_step: explanation.stepByStep,
              verification_result: verificationResult,
              visual_explanation: explanation.visualExplanation,
            })
            .select(
              "id, question_id, error_type, confidence, reasoning, correction, step_by_step, verification_result, created_at",
            )
            .single();

          if (diagErr || !diagnosisRow) {
            throw new Error(
              `Failed to save diagnosis for question ${question.id}: ${diagErr?.message ?? "unknown"}`,
            );
          }

          // 캐시 미스였으면 캐시에 저장
          if (!cached?.explanation && hash) {
            const classificationForCache = classificationMap.get(question.id) ?? null;
            await supabaseAdmin
              .from("question_cache")
              .upsert({
                content_hash: hash,
                classification: classificationForCache,
                explanation,
              }, { onConflict: "content_hash" })
              .then(() => {/* 캐시 저장 실패는 무시 */})
              .catch((err: unknown) => {
                console.warn("[analyze-exam] Cache upsert failed:", err);
              });
          }

          return { diagnosis: diagnosisRow as Record<string, unknown>, question };
        }),
      ),
    );

    // Collect successful diagnoses
    const diagnosisFailures: string[] = [];

    for (const result of diagnosisResults) {
      if (result.status === "fulfilled") {
        diagnosisEntries.push(result.value);
      } else {
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        diagnosisFailures.push(reason);
        console.error("[analyze-exam] Diagnosis failure:", reason);
      }
    }

    // 신규 분류 결과도 캐시에 저장 (분류만 있고 explanation은 아직 없는 경우)
    for (const c of newClassifications) {
      const question = questions.find((q) => q.id === c.questionId);
      if (!question) continue;
      const hash = hashMap.get(question.id);
      if (!hash || cacheMap.has(hash)) continue;
      // explanation은 나중에 오답 진단 시 저장되므로 여기서는 classification만
      await supabaseAdmin
        .from("question_cache")
        .upsert({
          content_hash: hash,
          classification: c,
          explanation: null,
        }, { onConflict: "content_hash" })
        .catch((err: unknown) => {
          console.warn("[analyze-exam] Classification cache upsert failed:", err);
        });
    }

    // If ALL questions failed, mark exam as error and return
    if (diagnosisEntries.length === 0 && diagnosisFailures.length > 0) {
      await supabaseAdmin
        .from("exams")
        .update({ status: "error" })
        .eq("id", examId);
      return errorResponse(
        `All questions failed analysis: ${diagnosisFailures[0]}`,
        500,
        "PIPELINE_ERROR",
      );
    }

    // --- 13. L4: Variant generation (per diagnosis) ---
    const allVariantIds: string[] = [];
    // 변형문항 검증 대상 수집
    const variantsToVerify: {
      id: string;
      content: string;
      question_type: string;
      options: string[] | null;
      answer: string;
    }[] = [];

    const variantResults = await Promise.allSettled(
      diagnosisEntries.map(async ({ diagnosis, question }) => {
        const variants = await generateVariantsAI(
          {
            error_type: diagnosis.error_type as string,
            reasoning: diagnosis.reasoning as string,
            correction: diagnosis.correction as string,
          },
          question,
          DEFAULT_VARIANT_COUNT,
          grade,
        );

        if (variants.length === 0) return [];

        const rows = variants.map((v) => ({
          diagnosis_id: diagnosis.id as string,
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

        const { data: savedVariants, error: varErr } = await supabaseAdmin
          .from("variant_questions")
          .insert(rows)
          .select("id, content, question_type, options, answer");

        if (varErr) {
          console.error("[analyze-exam] Variant insert error:", varErr);
          return [];
        }

        const saved = (savedVariants ?? []) as {
          id: string;
          content: string;
          question_type: string;
          options: string[] | null;
          answer: string;
        }[];

        // 변형문항 검증 대상에 추가
        for (const sv of saved) {
          variantsToVerify.push(sv);
        }

        return saved.map((v) => v.id);
      }),
    );

    for (const result of variantResults) {
      if (result.status === "fulfilled") {
        allVariantIds.push(...result.value);
      }
      // Variant failures are non-blocking
    }

    // --- 14. L4b: Variant answer verification ---
    // 각 변형문항의 정답을 GPT-4o-mini로 독립 검증
    if (variantsToVerify.length > 0) {
      const variantVerifyLimiter = createLimiter(5);
      const verifyResults = await Promise.allSettled(
        variantsToVerify.map((v) =>
          variantVerifyLimiter(() => verifyVariantAnswer(v)),
        ),
      );

      // 검증 결과를 배치로 DB에 반영
      const updatePromises: Promise<void>[] = [];
      for (const result of verifyResults) {
        if (result.status === "fulfilled") {
          const { variantId, verifierAnswer, briefSolution, match } = result.value;
          const verificationResult = {
            verified: true,
            verifier_answer: verifierAnswer,
            brief_solution: briefSolution,
            match,
          };
          updatePromises.push(
            supabaseAdmin
              .from("variant_questions")
              .update({ verification_result: verificationResult })
              .eq("id", variantId)
              .then(() => {/* 업데이트 성공 */})
              .catch((err: unknown) => {
                console.warn("[analyze-exam] Variant verification update failed:", err);
              }),
          );
        } else {
          // 검증 실패는 non-blocking — 로그만 남김
          console.warn("[analyze-exam] Variant verification failed:", result.reason);
        }
      }
      await Promise.all(updatePromises);
    }

    // --- 15. Credit deduction ---
    // 캐시 히트된 오답은 크레딧 차감에서 제외
    const creditsUsed = Math.max(0, wrongCount - cacheHits);
    if (creditsUsed > 0) {
      await supabaseAdmin
        .from("credits")
        .update({ used: credit.used + creditsUsed })
        .eq("user_id", userId);
    }

    // --- 16. Status update -> "analyzed" ---
    await supabaseAdmin
      .from("exams")
      .update({ status: "analyzed" })
      .eq("id", examId);

    // --- 17. Compute summary ---
    const correctCount = questions.filter(
      (q) => q.is_correct === true,
    ).length;
    const explicitWrongCount = questions.filter(
      (q) => q.is_correct === false,
    ).length;
    const unansweredCount =
      questions.length - correctCount - explicitWrongCount;

    return jsonResponse({
      examId,
      blueprintId,
      status: "analyzed",
      diagnosesCount: diagnosisEntries.length,
      variantsCount: allVariantIds.length,
      creditsUsed,
      cacheHits,
      partialFailures: diagnosisFailures.length,
      summary: {
        totalQuestions: questions.length,
        correctCount,
        wrongCount: explicitWrongCount,
        unansweredCount,
        accuracy:
          questions.length > 0
            ? Math.round((correctCount / questions.length) * 100) / 100
            : 0,
      },
    });
  } catch (error: unknown) {
    console.error("[analyze-exam] Unhandled error:", error);

    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      (error as { statusCode?: number })?.statusCode ??
      (error as { status?: number })?.status ??
      500;

    return errorResponse(message, status, "INTERNAL_ERROR");
  }
});
