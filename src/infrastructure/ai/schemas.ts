/**
 * JSON Schema definitions for OpenAI Structured Outputs (strict: true).
 * Used by AI gateway adapters to guarantee 100% schema compliance.
 */

/**
 * Schema for L1 OCR question extraction.
 * Matches the OcrResult domain entity shape (snake_case for AI output).
 */
export const OCR_QUESTIONS_SCHEMA = {
  type: 'object' as const,
  properties: {
    questions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          number: { type: 'integer' as const, description: '문항 번호' },
          content: { type: 'string' as const, description: '문항 본문 (LaTeX 수식은 $...$ 형식)' },
          type: { type: 'string' as const, enum: ['multiple_choice', 'short_answer', 'essay'] },
          options: {
            anyOf: [
              { type: 'array' as const, items: { type: 'string' as const } },
              { type: 'null' as const },
            ],
            description: '객관식 보기 배열 (주관식/서술형이면 null)',
          },
          answer: {
            anyOf: [
              { type: 'string' as const },
              { type: 'null' as const },
            ],
            description: '정답 (모르면 null)',
          },
          points: {
            anyOf: [
              { type: 'integer' as const },
              { type: 'null' as const },
            ],
            description: '배점 (모르면 null)',
          },
          needs_review: { type: 'boolean' as const, description: '텍스트 불명확 시 true' },
          ocr_confidence: { type: 'number' as const, description: '이 문항의 OCR 인식 정확도 (0.0~1.0)' },
        },
        required: ['number', 'content', 'type', 'options', 'answer', 'points', 'needs_review', 'ocr_confidence'] as const,
        additionalProperties: false,
      },
    },
    metadata: {
      type: 'object' as const,
      properties: {
        total_questions: { type: 'integer' as const },
        page_number: { type: 'integer' as const },
        confidence: { type: 'number' as const },
      },
      required: ['total_questions', 'page_number', 'confidence'] as const,
      additionalProperties: false,
    },
    exam_info: {
      type: 'object' as const,
      properties: {
        detected_subject: {
          type: 'string' as const,
          enum: ['math', 'korean', 'english', 'other'],
          description: '시험지에서 자동 감지된 과목',
        },
        detected_grade: {
          anyOf: [{ type: 'string' as const }, { type: 'null' as const }],
          description: '시험지에서 감지된 학년 (예: 중1, 중2, 고1, 고2, 고3)',
        },
        exam_type: {
          type: 'string' as const,
          enum: ['midterm_1', 'midterm_2', 'final_1', 'final_2', 'mock', 'other'],
          description: '시험 유형',
        },
      },
      required: ['detected_subject', 'detected_grade', 'exam_type'] as const,
      additionalProperties: false,
    },
  },
  required: ['questions', 'metadata', 'exam_info'] as const,
  additionalProperties: false,
};

/**
 * Shared schema for VisualExplanation discriminated union.
 * Used in both L3 (ErrorDiagnosis) and L4 (VariantQuestion) outputs.
 * Supports 3 types: flow (step-by-step), comparison (student vs correct), formula (line-by-line).
 */
export const VISUAL_EXPLANATION_SCHEMA = {
  type: 'object' as const,
  description: '풀이 과정의 시각적 도식. type에 따라 data 구조가 다릅니다. 반드시 생성해주세요 — 이것이 서비스의 핵심입니다.',
  properties: {
    type: {
      type: 'string' as const,
      enum: ['flow', 'comparison', 'formula'],
      description: '도식 유형: flow(다단계 풀이), comparison(학생vs정답 비교), formula(수식 분해)',
    },
    data: {
      type: 'object' as const,
      description: 'type에 따른 도식 데이터',
      properties: {
        // --- flow fields ---
        nodes: {
          anyOf: [
            {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  id: { type: 'string' as const },
                  type: { type: 'string' as const, enum: ['step', 'branch', 'error_point', 'result'] },
                  label: { type: 'string' as const, description: '15자 이내 한국어' },
                  latex: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                  status: { type: 'string' as const, enum: ['correct', 'error', 'neutral'] },
                },
                required: ['id', 'type', 'label', 'latex', 'status'] as const,
                additionalProperties: false,
              },
            },
            { type: 'null' as const },
          ],
        },
        edges: {
          anyOf: [
            {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  from: { type: 'string' as const },
                  to: { type: 'string' as const },
                  label: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                },
                required: ['from', 'to', 'label'] as const,
                additionalProperties: false,
              },
            },
            { type: 'null' as const },
          ],
        },
        error_node_id: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
        // --- comparison fields ---
        student_steps: {
          anyOf: [
            {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  label: { type: 'string' as const },
                  latex: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                  status: { type: 'string' as const, enum: ['correct', 'error', 'neutral'] },
                  annotation: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                },
                required: ['label', 'latex', 'status', 'annotation'] as const,
                additionalProperties: false,
              },
            },
            { type: 'null' as const },
          ],
        },
        correct_steps: {
          anyOf: [
            {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  label: { type: 'string' as const },
                  latex: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                  status: { type: 'string' as const, enum: ['correct', 'error', 'neutral'] },
                  annotation: { anyOf: [{ type: 'string' as const }, { type: 'null' as const }] },
                },
                required: ['label', 'latex', 'status', 'annotation'] as const,
                additionalProperties: false,
              },
            },
            { type: 'null' as const },
          ],
        },
        diverge_index: { anyOf: [{ type: 'integer' as const }, { type: 'null' as const }] },
        // --- formula fields ---
        lines: {
          anyOf: [
            {
              type: 'array' as const,
              items: {
                type: 'object' as const,
                properties: {
                  latex: { type: 'string' as const },
                  annotation: { type: 'string' as const },
                  is_error: { type: 'boolean' as const },
                },
                required: ['latex', 'annotation', 'is_error'] as const,
                additionalProperties: false,
              },
            },
            { type: 'null' as const },
          ],
        },
        error_line_index: { anyOf: [{ type: 'integer' as const }, { type: 'null' as const }] },
        // --- shared fields ---
        summary: { type: 'string' as const, description: '1줄 한국어 요약' },
        concept_keywords: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: '관련 개념 태그',
        },
      },
      required: [
        'nodes', 'edges', 'error_node_id',
        'student_steps', 'correct_steps', 'diverge_index',
        'lines', 'error_line_index',
        'summary', 'concept_keywords',
      ] as const,
      additionalProperties: false,
    },
  },
  required: ['type', 'data'] as const,
  additionalProperties: false,
};

/**
 * Schema for L3a Explanation / Error Diagnosis.
 * Guarantees all required fields from GPT-4o via Structured Outputs.
 * Used by OpenAIExplanationGateway.
 */
export const EXPLANATION_DIAGNOSIS_SCHEMA = {
  type: 'object' as const,
  properties: {
    error_type: {
      type: 'string' as const,
      enum: ['concept_gap', 'calculation_error', 'time_pressure'],
      description: '오답 원인 유형',
    },
    confidence: {
      type: 'number' as const,
      description: '분류 확신도 (0.0~1.0)',
    },
    correct_answer: {
      type: 'string' as const,
      description: '정답 (LaTeX 형식)',
    },
    step_by_step: {
      type: 'string' as const,
      description: '단계별 풀이 (1단계, 2단계, ... 형식, LaTeX 수식 포함)',
    },
    error_reasoning: {
      type: 'string' as const,
      description: '오답 원인 분석 (한국어, LaTeX 수식 포함 가능)',
    },
    correction_guidance: {
      type: 'string' as const,
      description: '교정 안내 (한국어, 구체적인 학습 방향 포함)',
    },
    visual_explanation: VISUAL_EXPLANATION_SCHEMA,
  },
  required: [
    'error_type',
    'confidence',
    'correct_answer',
    'step_by_step',
    'error_reasoning',
    'correction_guidance',
    'visual_explanation',
  ] as const,
  additionalProperties: false,
};

/**
 * Schema for variant question generation (L4).
 * Used by both error-correction and topic-based generation.
 *
 * With strict: true, ALL properties must be in required array.
 * Nullable fields use type: ['string', 'null'] or type: ['integer', 'null'].
 */
export const VARIANT_QUESTIONS_SCHEMA = {
  type: 'object' as const,
  properties: {
    variants: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          content: { type: 'string' as const, description: '문항 본문 (LaTeX 수식 포함)' },
          type: { type: 'string' as const, enum: ['multiple_choice', 'short_answer'] },
          options: {
            anyOf: [
              { type: 'array' as const, items: { type: 'string' as const } },
              { type: 'null' as const },
            ],
            description: '객관식 보기 배열 (주관식이면 null)',
          },
          answer: { type: 'string' as const, description: '정답' },
          explanation: { type: 'string' as const, description: '단계별 풀이 해설 (LaTeX)' },
          difficulty: { type: 'string' as const, enum: ['easy', 'medium', 'hard'] },
          target_error_type: {
            type: 'string' as const,
            enum: ['concept_gap', 'calculation_error', 'time_pressure', 'comprehension_error', 'grammar_error', 'vocabulary_gap', 'interpretation_error'],
          },
          bloom_level: {
            type: 'string' as const,
            enum: ['knowledge', 'comprehension', 'application', 'analysis', 'synthesis', 'evaluation'],
            description: 'Bloom 인지 수준',
          },
          trap_point: {
            anyOf: [
              { type: 'string' as const },
              { type: 'null' as const },
            ],
            description: '함정 포인트 (계산실수 교정용)',
          },
          target_time_seconds: {
            anyOf: [
              { type: 'integer' as const },
              { type: 'null' as const },
            ],
            description: '목표 풀이 시간 (초)',
          },
          visual_explanation: VISUAL_EXPLANATION_SCHEMA,
        },
        required: [
          'content', 'type', 'options', 'answer', 'explanation',
          'difficulty', 'target_error_type', 'bloom_level', 'trap_point', 'target_time_seconds',
          'visual_explanation',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['variants'],
  additionalProperties: false,
};
