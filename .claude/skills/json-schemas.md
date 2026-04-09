# JSON Schema 정의

모든 AI 출력에 Structured Output(JSON Schema)을 강제하여 파싱 오류 원천 차단.
OpenAI: `response_format.json_schema.strict = true` → 100% 스키마 준수 보장.
Claude: `tool_use` 기능으로 유사 효과 달성.

## 1. QuestionSplit (문항 분리)

```json
{
  "name": "question_split",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "exam_info": {
        "type": "object",
        "properties": {
          "total_pages": { "type": "integer" },
          "total_questions": { "type": "integer" },
          "ocr_confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["total_pages", "total_questions", "ocr_confidence"],
        "additionalProperties": false
      },
      "questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "number": { "type": "integer" },
            "content": { "type": "string", "description": "문항 본문 (LaTeX 수식 포함)" },
            "options": {
              "type": "array",
              "items": { "type": "string" },
              "description": "객관식 보기 배열 (주관식이면 빈 배열)"
            },
            "answer": { "type": "string", "description": "정답 (OCR에서 추출 가능한 경우)" },
            "points": { "type": "integer", "description": "배점" },
            "has_image": { "type": "boolean", "description": "그래프/도형 포함 여부" },
            "image_description": { "type": "string", "description": "그래프/도형 텍스트 설명" },
            "ocr_uncertain": {
              "type": "array",
              "items": { "type": "string" },
              "description": "OCR 인식 불확실 부분"
            }
          },
          "required": ["number", "content", "options", "points", "has_image"],
          "additionalProperties": false
        }
      }
    },
    "required": ["exam_info", "questions"],
    "additionalProperties": false
  }
}
```

## 2. Blueprint (블루프린트)

```json
{
  "name": "exam_blueprint",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "exam_info": {
        "type": "object",
        "properties": {
          "subject": { "type": "string" },
          "grade": { "type": "string" },
          "exam_type": { "type": "string", "enum": ["midterm", "final", "mock"] },
          "total_questions": { "type": "integer" },
          "total_points": { "type": "integer" }
        },
        "required": ["subject", "grade", "exam_type", "total_questions", "total_points"],
        "additionalProperties": false
      },
      "unit_distribution": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "unit_name": { "type": "string" },
            "sub_unit": { "type": "string" },
            "question_count": { "type": "integer" },
            "percentage": { "type": "number" },
            "avg_difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] },
            "question_numbers": { "type": "array", "items": { "type": "integer" } }
          },
          "required": ["unit_name", "sub_unit", "question_count", "percentage", "avg_difficulty", "question_numbers"],
          "additionalProperties": false
        }
      },
      "type_distribution": {
        "type": "object",
        "properties": {
          "multiple_choice": { "type": "integer" },
          "short_answer": { "type": "integer" },
          "essay": { "type": "integer" }
        },
        "required": ["multiple_choice", "short_answer", "essay"],
        "additionalProperties": false
      },
      "difficulty_distribution": {
        "type": "object",
        "properties": {
          "easy": { "type": "number" },
          "medium": { "type": "number" },
          "hard": { "type": "number" }
        },
        "required": ["easy", "medium", "hard"],
        "additionalProperties": false
      },
      "insights": {
        "type": "array",
        "items": { "type": "string" },
        "description": "출제 패턴 인사이트 2~3개"
      }
    },
    "required": ["exam_info", "unit_distribution", "type_distribution", "difficulty_distribution", "insights"],
    "additionalProperties": false
  }
}
```

## 3. Explanation (해설)

```json
{
  "name": "question_explanation",
  "schema": {
    "type": "object",
    "properties": {
      "question_id": { "type": "integer" },
      "steps": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "step_number": { "type": "integer" },
            "description": { "type": "string" },
            "math_expression": { "type": "string", "description": "LaTeX 수식" },
            "reasoning": { "type": "string", "description": "왜 이렇게 하는가 근거" }
          },
          "required": ["step_number", "description", "reasoning"]
        }
      },
      "final_answer": { "type": "string" },
      "key_concepts": { "type": "array", "items": { "type": "string" } },
      "common_mistakes": { "type": "array", "items": { "type": "string" } },
      "classification_reason": { "type": "string", "description": "단원 분류 근거 1줄" }
    },
    "required": ["question_id", "steps", "final_answer", "key_concepts"]
  }
}
```

## 4. Verification (검산)

```json
{
  "name": "verification_result",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "question_id": { "type": "integer" },
      "computed_answer": { "type": "string" },
      "solution_summary": { "type": "string", "description": "풀이 요약 1~2줄" },
      "method_used": { "type": "string", "description": "사용한 풀이 방법" }
    },
    "required": ["question_id", "computed_answer", "solution_summary", "method_used"],
    "additionalProperties": false
  }
}
```

## 5. ErrorDiagnosis (오답 진단)

```json
{
  "name": "error_diagnosis",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "question_id": { "type": "integer" },
      "error_type": {
        "type": "string",
        "enum": ["concept_lack", "calculation_mistake", "time_shortage"]
      },
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "reasoning": { "type": "string", "description": "판단 근거 상세" },
      "lacking_concept": { "type": "string", "description": "부족한 개념 (concept_lack인 경우)" },
      "mistake_pattern": { "type": "string", "description": "실수 패턴 (calculation_mistake인 경우)" },
      "correction_strategy": { "type": "string", "description": "교정 전략" },
      "related_concepts": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["question_id", "error_type", "confidence", "reasoning", "correction_strategy", "related_concepts"],
    "additionalProperties": false
  }
}
```

## 6. VariantQuestion (변형문항)

```json
{
  "name": "variant_questions",
  "schema": {
    "type": "object",
    "properties": {
      "source_question_id": { "type": "integer" },
      "error_type": { "type": "string" },
      "variants": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "content": { "type": "string", "description": "문항 본문 (LaTeX)" },
            "options": { "type": "array", "items": { "type": "string" } },
            "correct_answer": { "type": "string" },
            "explanation": { "type": "string", "description": "간결한 해설" },
            "trap_point": { "type": "string", "description": "함정 포인트 (계산실수 교정용)" },
            "difficulty": { "type": "string", "enum": ["easy", "medium", "hard"] },
            "bloom_level": {
              "type": "string",
              "enum": ["knowledge", "comprehension", "application", "analysis", "synthesis", "evaluation"]
            },
            "target_time_seconds": { "type": "integer", "description": "목표 풀이 시간(초)" }
          },
          "required": ["content", "options", "correct_answer", "explanation", "difficulty", "bloom_level"]
        }
      }
    },
    "required": ["source_question_id", "error_type", "variants"]
  }
}
```

## 7. 2중 검증 결과 (ConfidenceResult)

```json
{
  "name": "confidence_result",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "question_id": { "type": "integer" },
      "model_a_answer": { "type": "string" },
      "model_b_answer": { "type": "string" },
      "answers_match": { "type": "boolean" },
      "confidence_level": { "type": "string", "enum": ["high", "needs_review"] },
      "discrepancy_note": { "type": "string", "description": "불일치 시 설명" }
    },
    "required": ["question_id", "model_a_answer", "model_b_answer", "answers_match", "confidence_level"],
    "additionalProperties": false
  }
}
```
