# RAG 파이프라인 상세 설계

## Hybrid RAG 아키텍처 (2025 최신 연구 기반)

2025년 연구 합의: Dense+Sparse+Re-Ranking 조합이 최적 검색 성능.

### 4단계 RAG 파이프라인

#### 1. 인덱싱 (Indexing)

```
기출문제 원문 → 청킹(500자 + 100자 오버랩) → KURE-v1 임베딩 → pgvector 저장
```

```typescript
// 청킹 전략: 문항 단위 보존
interface QuestionChunk {
  id: string;
  content: string;         // 문항 본문 (500자 이내)
  metadata: {
    school: string;        // 학교명
    grade: number;         // 학년
    year: number;          // 출제연도
    semester: string;      // 학기
    exam_type: string;     // 중간/기말
    unit: string;          // 단원
    sub_unit: string;      // 소단원
    difficulty: string;    // 상/중/하
    question_type: string; // 객관식/주관식/서술형
    bloom_level: string;   // Bloom 인지 수준
  };
  embedding: number[];     // 768차원 벡터
}
```

**청킹 규칙**:
- 수학 문항은 문항 단위로 청킹 (문항 분리 = 청크 경계)
- 보기(①②③④⑤)와 본문은 하나의 청크로 유지
- 그래프/도형 설명은 텍스트로 변환하여 포함
- 풀이/해설은 별도 청크로 분리하되 question_id로 연결

#### 2. 검색 (Retrieval) - Hybrid

```typescript
async function hybridSearch(query: string, filters: object, topK: number = 20) {
  // Dense: pgvector 코사인 유사도
  const denseResults = await supabase.rpc('match_questions', {
    query_embedding: await embed(query), // KURE-v1
    match_threshold: 0.7,
    match_count: topK
  });

  // Sparse: PostgreSQL Full-Text Search (BM25 대안)
  const sparseResults = await supabase
    .from('questions')
    .select('*')
    .textSearch('content', query, { type: 'websearch', config: 'korean' });

  // RRF (Reciprocal Rank Fusion)
  return reciprocalRankFusion(denseResults, sparseResults, k=60);
}

function reciprocalRankFusion(
  ...resultSets: SearchResult[][], 
  k: number = 60
): SearchResult[] {
  const scores = new Map<string, number>();
  for (const results of resultSets) {
    results.forEach((result, rank) => {
      const id = result.id;
      const current = scores.get(id) || 0;
      scores.set(id, current + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => findResult(id));
}
```

#### 3. 증강 (Augmentation) - Corrective + GraphRAG

```typescript
// Corrective RAG: 검색 결과 품질 자동 판정
async function correctiveRAG(query: string, retrievedDocs: Doc[]): Promise<Doc[]> {
  const evaluation = await llm.evaluate({
    prompt: `다음 검색 결과가 쿼리에 적합한지 판정하세요.
    쿼리: ${query}
    문서: ${JSON.stringify(retrievedDocs)}
    
    각 문서에 대해 "correct", "ambiguous", "incorrect" 판정.`,
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' }
  });

  const correct = evaluation.filter(d => d.judgment === 'correct');
  const ambiguous = evaluation.filter(d => d.judgment === 'ambiguous');
  
  // ambiguous 문서는 KG로 관계 확장 후 재판정
  if (ambiguous.length > 0) {
    const expanded = await graphRAGExpand(ambiguous, query);
    correct.push(...expanded.filter(d => d.relevance > 0.8));
  }
  
  return correct;
}

// GraphRAG: 교육과정 KG 기반 관계 확장
async function graphRAGExpand(docs: Doc[], query: string): Promise<Doc[]> {
  // 문항의 단원/개념에서 선수학습/연관 개념 탐색
  const concepts = extractConcepts(docs);
  const relatedConcepts = await traverseKnowledgeGraph(concepts, depth=2);
  
  // 관련 개념의 기출문제 추가 검색
  return await searchByConceptsFromKG(relatedConcepts);
}
```

#### 4. 생성 (Generation) - Self-RAG

```typescript
// Self-RAG: 생성 후 자체 검증 루프
async function selfRAGGenerate(context: Doc[], task: string): Promise<GeneratedQuestion> {
  // 1차 생성
  const generated = await claude.generate({
    context,
    task,
    model: 'claude-sonnet'
  });

  // 자체 검증: 생성된 문제가 컨텍스트에 충실한가?
  const verification = await gpt.verify({
    prompt: `생성된 수학 문제의 품질을 검증하세요:
    1. 수학적 정확성 (정답이 맞는가?)
    2. 컨텍스트 충실성 (원본 기출 패턴과 일치하는가?)
    3. 교육적 적절성 (난이도/인지수준이 적절한가?)
    
    문제: ${JSON.stringify(generated)}`,
    model: 'gpt-4o-mini'
  });

  if (verification.score < 0.8) {
    // 재생성 with 피드백
    return selfRAGGenerate(context, task + `\n피드백: ${verification.feedback}`);
  }

  return generated;
}
```

## Advanced RAG 기법 적용 가이드

### Sufficient Context (Google Research, ICLR 2025)

검색된 문서의 "충분성"을 판단. 기출문제가 부족하면 추가 검색 트리거.

```typescript
async function checkSufficiency(query: string, docs: Doc[]): Promise<boolean> {
  const result = await llm.evaluate({
    prompt: `이 컨텍스트로 "${query}"에 대한 문제를 생성하기에 충분한가?
    부족한 정보가 있다면 무엇인가?`,
    model: 'gpt-4o-mini'
  });
  return result.sufficient; // boolean
}
```

### MC-RAG (문서 공동 출현 패턴)

같은 학교/교사의 기출문제 패턴을 분석하여 출제 경향 파악.

### Speculative Pipelining

검색과 생성을 병렬 실행하여 TTFT(Time to First Token) 20-30% 감소.

## 기출문제 적중 시스템 6단계

```
Step 1: 기출 데이터 수집 (사용자 업로드 + 공개 데이터)
Step 2: 패턴 분석 (학교별/교사별 출제 경향 블루프린트)
Step 3: RAG 검색 (유사 패턴 과거 기출 + 교과서 단원 매칭)
Step 4: GraphRAG 확장 (출제 가능 개념의 관계 그래프 탐색)
Step 5: 예측 문제 생성 (IRT 난이도 조절 + Bloom 인지수준 매칭)
Step 6: Self-RAG 자체 검증 (수학적 정확성 + 2중 검산)
```

## 평가 지표

| 영역 | 지표 | 목표치 |
|------|------|--------|
| 검색 품질 | Precision@5, NDCG | >80% |
| 생성 품질 | Faithfulness | >90% |
| 적중률 | 단원 적중 비율 | >70% |
| 교육 품질 | 사용자 엄지업 비율 | >80% |
| 시스템 성능 | 응답 시간 | <30초 |

## 핵심 논문 참조

| 논문 | 출처 | 적용 |
|------|------|------|
| RAG Comprehensive Survey | arXiv:2506.00054 | Hybrid RAG 분류 체계 |
| Systematic Review of Key RAG Systems | arXiv:2507.18910 | 진화 과정 + 평가 프레임워크 |
| CRAG (Corrective RAG) | Yan et al. 2025 | 검색 결과 자동 교정 |
| Self-RAG | Asai et al. 2025 | 생성 품질 자체 검증 |
| KA-RAG | MDPI Nov 2025 | KG + Agentic RAG, 91.4% 정확도 |
| KAQG | arXiv:2505.07618 | IRT + Bloom + KG + Multi-Agent RAG |
