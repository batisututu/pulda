# 교육과정 Knowledge Graph + GraphRAG 설계

## Knowledge Graph 구조

### 노드 유형 (6계층)

```
과목 > 단원 > 소단원 > 개념 > 공식 > 문제유형
```

### 관계 유형

| 관계 | 의미 | 예시 |
|------|------|------|
| `CONTAINS` | 포함 | 수학I → 지수함수와 로그함수 |
| `PREREQUISITE` | 선수학습 | 이차함수 → 일차함수 |
| `APPLIES_TO` | 적용 | 근의공식 → 이차방정식 풀이 |
| `SIMILAR_TO` | 유사 | 등차수열 ↔ 등비수열 |
| `TESTED_AS` | 출제형태 | 이차함수 최대최소 → 서술형 |
| `DIFFICULTY_UP` | 상위 난이도 | 기본 미분 → 합성함수 미분 |

### PostgreSQL 재귀 쿼리 구현 (Neo4j 대안)

```sql
-- 노드 테이블
CREATE TABLE kg_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL, -- 'subject','unit','sub_unit','concept','formula','question_type'
  name TEXT NOT NULL,
  name_ko TEXT NOT NULL,   -- 한국어 이름
  grade TEXT,              -- 대상 학년
  pagerank FLOAT DEFAULT 0, -- 출제 빈도 가중치
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 관계 테이블
CREATE TABLE kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES kg_nodes(id),
  target_id UUID REFERENCES kg_nodes(id),
  relation_type TEXT NOT NULL, -- 'CONTAINS','PREREQUISITE','APPLIES_TO','SIMILAR_TO'...
  weight FLOAT DEFAULT 1.0,   -- 관계 강도
  metadata JSONB
);

-- 인덱스
CREATE INDEX idx_kg_edges_source ON kg_edges(source_id);
CREATE INDEX idx_kg_edges_target ON kg_edges(target_id);
CREATE INDEX idx_kg_nodes_type ON kg_nodes(node_type);

-- 재귀 쿼리: 특정 개념의 선수학습 체인 탐색
WITH RECURSIVE prereq_chain AS (
  SELECT n.id, n.name_ko, 0 AS depth
  FROM kg_nodes n
  WHERE n.name_ko = '이차함수'
  
  UNION ALL
  
  SELECT n.id, n.name_ko, pc.depth + 1
  FROM kg_edges e
  JOIN kg_nodes n ON e.target_id = n.id
  JOIN prereq_chain pc ON e.source_id = pc.id
  WHERE e.relation_type = 'PREREQUISITE'
    AND pc.depth < 5 -- 최대 탐색 깊이
)
SELECT * FROM prereq_chain;

-- 재귀 쿼리: 특정 단원의 관련 개념 확장 (GraphRAG 핵심)
WITH RECURSIVE related_concepts AS (
  SELECT n.id, n.name_ko, n.node_type, 0 AS depth, n.pagerank
  FROM kg_nodes n
  WHERE n.name_ko = '이차방정식'
  
  UNION ALL
  
  SELECT n.id, n.name_ko, n.node_type, rc.depth + 1, n.pagerank
  FROM kg_edges e
  JOIN kg_nodes n ON (e.target_id = n.id OR e.source_id = n.id)
  JOIN related_concepts rc ON (e.source_id = rc.id OR e.target_id = rc.id)
  WHERE e.relation_type IN ('SIMILAR_TO', 'APPLIES_TO', 'PREREQUISITE')
    AND rc.depth < 2
    AND n.id != rc.id
)
SELECT DISTINCT ON (id) * FROM related_concepts ORDER BY id, pagerank DESC;
```

## 고등학교 수학 KG 데이터 예시

```json
{
  "nodes": [
    { "type": "subject", "name": "수학I" },
    { "type": "unit", "name": "지수함수와 로그함수", "parent": "수학I" },
    { "type": "sub_unit", "name": "지수", "parent": "지수함수와 로그함수" },
    { "type": "sub_unit", "name": "로그", "parent": "지수함수와 로그함수" },
    { "type": "sub_unit", "name": "지수함수", "parent": "지수함수와 로그함수" },
    { "type": "sub_unit", "name": "로그함수", "parent": "지수함수와 로그함수" },
    { "type": "concept", "name": "지수법칙", "parent": "지수" },
    { "type": "concept", "name": "로그의 정의", "parent": "로그" },
    { "type": "concept", "name": "로그의 성질", "parent": "로그" },
    { "type": "formula", "name": "a^m × a^n = a^(m+n)", "parent": "지수법칙" },
    { "type": "formula", "name": "log_a(xy) = log_a(x) + log_a(y)", "parent": "로그의 성질" }
  ],
  "edges": [
    { "from": "로그의 정의", "to": "지수법칙", "type": "PREREQUISITE" },
    { "from": "지수함수", "to": "로그함수", "type": "SIMILAR_TO" },
    { "from": "지수법칙", "to": "지수함수", "type": "APPLIES_TO" }
  ]
}
```

## GraphRAG 통합 검색 알고리즘

```typescript
async function graphRAGSearch(query: string, userContext: UserContext) {
  // 1. 쿼리에서 수학 개념 추출
  const concepts = await extractMathConcepts(query);
  
  // 2. KG에서 관련 노드 탐색 (depth=2)
  const kgNodes = await traverseKG(concepts, { maxDepth: 2 });
  
  // 3. PageRank 기반 중요도 정렬
  const rankedNodes = kgNodes.sort((a, b) => b.pagerank - a.pagerank);
  
  // 4. 관련 개념의 기출문제 벡터 검색
  const relatedQuestions = await vectorSearch(rankedNodes, {
    school: userContext.school,
    grade: userContext.grade,
    topK: 10
  });
  
  // 5. 선수학습 체인 포함 (개념 부족 교정 시)
  if (userContext.errorType === 'concept_lack') {
    const prereqs = await getPrerequisiteChain(concepts[0]);
    relatedQuestions.push(...await vectorSearch(prereqs, { topK: 5 }));
  }
  
  return relatedQuestions;
}
```

## KAQG 프레임워크 적용 (IRT + Bloom)

### IRT (문항반응이론) 난이도 보정

```typescript
interface IRTParameters {
  difficulty: number;      // b: 난이도 (-3 ~ +3)
  discrimination: number;  // a: 변별도 (0 ~ 3)
  guessing: number;       // c: 추측 확률 (0 ~ 0.25 for 5지선다)
}

// 3PL 모델로 문항 난이도 보정
function irtProbability(theta: number, params: IRTParameters): number {
  const { difficulty: b, discrimination: a, guessing: c } = params;
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)));
}
```

### Bloom 인지 분류 체계

| 수준 | 코드 | 수학 적용 예시 |
|------|------|---------------|
| 지식 (K1) | knowledge | 공식 암기, 정의 재현 |
| 이해 (K2) | comprehension | 개념 설명, 예시 식별 |
| 적용 (K3) | application | 공식 대입, 단순 문제 풀이 |
| 분석 (K4) | analysis | 풀이 전략 선택, 조건 분석 |
| 종합 (K5) | synthesis | 여러 개념 결합, 증명 구성 |
| 평가 (K6) | evaluation | 풀이 검증, 최적 방법 판단 |

오답 유형과 Bloom 수준 매핑:
- 개념 부족 → K1~K2 수준 변형문항으로 교정
- 계산 실수 → K3 수준 반복 훈련
- 시간 부족 → K4~K5 수준 빠른 풀이법 훈련
