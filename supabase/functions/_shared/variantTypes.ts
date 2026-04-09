/**
 * 변형문항 생성 공용 타입 및 시스템 프롬프트
 *
 * analyze-exam, generate-variants 양쪽에서 공유
 */

// ---------------------------------------------------------------------------
// L4 변형문항 시스템 프롬프트
// ---------------------------------------------------------------------------

/**
 * 과목/학년별 변형문항 생성 시스템 프롬프트 생성
 */
export function buildVariantSystem(subject: string, grade: string): string {
  const subjectLabel: Record<string, string> = {
    math: "수학",
    korean: "국어",
    english: "영어",
  };
  const label = subjectLabel[subject] ?? "수학/국어/영어";

  // 과목별 추가 지침
  const subjectSpecificRules: Record<string, string[]> = {
    math: [
      "- 수학 수식은 반드시 LaTeX $...$ 형식으로 작성하세요.",
      "- 그림/도형이 필요한 문제는 [Figure: 설명] 형식으로 포함하세요.",
    ],
    korean: [
      "- 지문 기반 문항은 반드시 새로운 지문을 생성하세요. 원본 지문의 주제와 난이도만 유지하고 내용은 완전히 변경하세요.",
      "- 비문학 지문은 200-400자, 문학 지문은 적절한 분량으로 생성하세요.",
      "- 지문은 [지문] 태그로 구분하세요.",
      "- <보기>가 필요한 문항은 새로운 <보기>를 생성하세요.",
    ],
    english: [
      "- 영어 지문은 학년 수준에 맞는 어휘와 문법을 사용하세요.",
      "- 빈칸추론, 순서배열, 요지파악, 문장삽입 등 수능 유형에 맞게 생성하세요.",
      "- 지문은 [Passage] 태그로 구분하세요.",
      "- 밑줄은 __underlined__ 형식, 빈칸은 _______ 형식으로 표시하세요.",
    ],
  };

  const extraRules = subjectSpecificRules[subject] ?? [];

  const lines = [
    `당신은 한국 ${label} 시험 변형문항 생성 전문가입니다.`,
    "학생의 오답 진단 결과를 바탕으로, 해당 약점을 교정하는 변형문항을 생성합니다.",
    `학년: ${grade} 수준의 교육과정 범위 내에서 출제하세요.`,
    "",
    "중요: 원본 문제의 숫자, 수식, 보기를 완전히 변경하세요 (저작권 보호). 문제 구조와 개념은 유지하되, 구체적인 값은 모두 새로 만들어야 합니다.",
    "",
    "전략 (오답 유형별):",
    "- concept_gap: 난이도를 easy → medium → hard 순으로 점진적으로 높이세요 (기본 개념 → 응용)",
    "- calculation_error: 동일 구조에서 숫자만 변경하고, 흔히 실수하는 함정 보기를 포함하세요",
    "- time_pressure: 제한 시간 풀이에 적합한 문제를 생성하고, 풀이 단축 팁을 explanation에 포함하세요",
    "- comprehension_error: 지문 해석력을 단계별로 강화하는 문제를 생성하세요",
    "- grammar_error: 문법 규칙을 기초부터 응용까지 점진적으로 생성하세요",
    "- vocabulary_gap: 어휘 난이도를 점진적으로 높이세요",
    "- interpretation_error: 해석 깊이를 점진적으로 높이는 문제를 생성하세요",
  ];

  // 과목별 추가 지침 삽입
  if (extraRules.length > 0) {
    lines.push("");
    lines.push(`## ${label} 과목 전용 지침:`);
    lines.push(...extraRules);
  }

  lines.push(
    "",
    "난이도 분배 규칙: 생성할 문항이 3개 이상일 때, 난이도를 easy, medium, hard 순서로 점진적으로 배분하세요.",
    "",
    "각 변형문항은 반드시 다음 필드를 포함:",
    "content (문항 본문, 수학은 LaTeX $...$ 형식),",
    "type (multiple_choice/short_answer),",
    "options (객관식이면 5개 보기 배열, 주관식이면 null),",
    "answer (정답),",
    "explanation (단계별 풀이 해설, LaTeX 포함),",
    "difficulty (easy/medium/hard),",
    "target_error_type (concept_gap/calculation_error/time_pressure/comprehension_error/grammar_error/vocabulary_gap/interpretation_error),",
    "bloom_level (knowledge/comprehension/application/analysis/synthesis/evaluation),",
    "trap_point (계산실수 교정용 함정 설명, 해당 없으면 null),",
    "target_time_seconds (시간압박 교정용 목표 풀이 시간(초), 해당 없으면 null),",
    "visual_explanation (풀이 시각화 도식)",
    "",
    "visual_explanation 규칙:",
    '- concept_gap → type: "flow" (개념 흐름 도식)',
    "  data: { nodes: [{id, type, label, latex, status}], edges: [{from, to, label}], error_node_id, summary, concept_keywords,",
    "          student_steps: null, correct_steps: null, diverge_index: null, lines: null, error_line_index: null }",
    '- calculation_error → type: "comparison" (학생 풀이 vs 정답 비교)',
    "  data: { student_steps: [{label, latex, status, annotation}], correct_steps: [{label, latex, status, annotation}], diverge_index, summary, concept_keywords,",
    "          nodes: null, edges: null, error_node_id: null, lines: null, error_line_index: null }",
    '- time_pressure → type: "formula" (핵심 수식 분해)',
    "  data: { lines: [{latex, annotation, is_error}], error_line_index, summary, concept_keywords,",
    "          nodes: null, edges: null, error_node_id: null, student_steps: null, correct_steps: null, diverge_index: null }",
    "- 국어/영어 과목은 flow 또는 comparison 중 가장 적합한 type을 선택하세요 (formula는 수학 전용)",
    "- data 객체의 모든 필드는 반드시 포함하되, 사용하지 않는 필드는 null로 설정하세요",
    "",
    '응답 형식: { "variants": [ ... ] }',
    "JSON만 출력하세요.",
  );

  return lines.join("\n");
}

/** 하위 호환성용 — 기존 상수 참조를 유지하되 기본값으로 호출 */
export const VARIANT_SYSTEM = buildVariantSystem("math", "high1");

// ---------------------------------------------------------------------------
// AI 응답 파싱용 Raw 타입 (snake_case)
// ---------------------------------------------------------------------------

export interface VisualExplanationRaw {
  type: "flow" | "comparison" | "formula";
  data: Record<string, unknown>;
}

export interface VariantRaw {
  content: string;
  type: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  difficulty: string;
  target_error_type: string;
  bloom_level: string;
  trap_point: string | null;
  target_time_seconds: number | null;
  visual_explanation?: VisualExplanationRaw | null;
}

// ---------------------------------------------------------------------------
// visual_explanation 유효성 검증 — 파싱 실패 시 null 반환
// ---------------------------------------------------------------------------

const VALID_VE_TYPES = ["flow", "comparison", "formula"];

export function parseVisualExplanation(
  raw: unknown,
): VisualExplanationRaw | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.type !== "string" || !VALID_VE_TYPES.includes(obj.type)) {
    return null;
  }
  if (!obj.data || typeof obj.data !== "object") return null;
  return { type: obj.type as VisualExplanationRaw["type"], data: obj.data as Record<string, unknown> };
}
