# 풀다 (StudyAI) 수동 테스트 가이드

이 문서는 앱을 직접 실행하고 모든 기능을 화면별로 검증하기 위한 상세 가이드입니다.

---

## 1. 환경 설정

### 1.1 필수 도구

| 도구 | 최소 버전 | 설치 확인 |
|------|----------|----------|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| Expo CLI | (npx 사용) | `npx expo --version` |
| Supabase CLI | (npx 사용) | `npx supabase --version` |
| Expo Go 앱 | 최신 | App Store / Google Play |

에뮬레이터를 사용할 경우:
- **iOS**: Xcode + iOS Simulator (macOS만 가능)
- **Android**: Android Studio + AVD Manager

### 1.2 환경 변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 아래 값을 채웁니다.

| 변수명 | 설명 | 어디서 확인 |
|--------|------|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (공개) 키 | Supabase Dashboard > Settings > API |
| `EXPO_PUBLIC_PORTONE_STORE_ID` | PortOne 스토어 ID | PortOne 관리자 콘솔 |
| `EXPO_PUBLIC_PORTONE_CHANNEL_KEY` | PortOne 채널 키 | PortOne 관리자 콘솔 |

> **보안 주의**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORTONE_API_SECRET`, `RESEND_API_KEY` 등 서버 전용 키는 절대 `.env.local`에 넣지 마세요. 이 키들은 Supabase Edge Function 환경변수로만 설정합니다.

### 1.3 Supabase 프로젝트 설정

#### 1.3.1 프로젝트 생성
1. [supabase.com](https://supabase.com) 접속 후 로그인
2. "New Project" 클릭 > 프로젝트명, DB 비밀번호, 리전 설정 후 생성
3. Settings > API 페이지에서 URL과 anon key를 `.env.local`에 복사

#### 1.3.2 데이터베이스 스키마 생성
1. Supabase Dashboard > SQL Editor 이동
2. `supabase/migrations/001_initial_schema.sql` 파일 내용을 복사하여 실행
3. Table Editor에서 테이블이 생성되었는지 확인:
   `users`, `exams`, `questions`, `error_diagnoses`, `variant_questions`,
   `mini_tests`, `mini_test_answers`, `blueprints`, `credits`,
   `follows`, `shared_items`, `parent_links`, `notifications`

#### 1.3.3 Storage 버킷 생성
1. Supabase Dashboard > Storage 이동
2. "New bucket" 클릭
3. 이름: `exam-images`, Public: **OFF** (비공개)
4. 저장

#### 1.3.4 Edge Functions 시크릿 설정
```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-openai-key
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 1.3.5 Edge Functions 배포
```bash
npx supabase functions deploy run-ocr
npx supabase functions deploy analyze-exam
npx supabase functions deploy generate-variants
```

또는 한번에 전체 배포:
```bash
npx supabase functions deploy
```

### 1.4 의존성 설치 및 앱 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm start
```

실행 후:
- **Expo Go (모바일)**: 터미널에 표시되는 QR 코드를 Expo Go 앱으로 스캔
- **Android 에뮬레이터**: 터미널에서 `a` 키 입력
- **iOS 시뮬레이터**: 터미널에서 `i` 키 입력 (macOS만 가능)

---

## 2. 테스트 시나리오 (화면별 체크리스트)

각 시나리오를 순서대로 진행합니다. 체크박스를 사용해 완료 여부를 기록하세요.

### 시나리오 1: 회원가입 + 온보딩

**경로**: `app/(auth)/login.tsx` -> `app/(auth)/signup.tsx` -> `app/onboarding.tsx`

- [ ] 앱 최초 실행 시 로그인 화면(`login.tsx`)이 표시되는지 확인
- [ ] "회원가입" 링크 터치 -> 회원가입 화면(`signup.tsx`)으로 이동
- [ ] 이메일, 비밀번호, 역할(학생/학부모) 입력 후 "회원가입" 제출
- [ ] 회원가입 성공 후 온보딩 화면(`onboarding.tsx`) 자동 이동
- [ ] 닉네임, 학년 설정 후 "시작하기" 터치
- [ ] 메인 탭 화면(`app/(tabs)/index.tsx`)으로 이동 확인
- [ ] **DB 검증**: Supabase Dashboard > Authentication > Users 에서 새 유저 확인
- [ ] **DB 검증**: Table Editor > `users` 테이블에 프로필 레코드 생성 확인

### 시나리오 2: 시험 업로드 + OCR

**경로**: `app/(tabs)/upload.tsx`

- [ ] 하단 탭에서 업로드 탭 이동
- [ ] 과목 선택 (수학)
- [ ] 카메라 촬영 또는 갤러리에서 시험지 사진 선택
  - 카메라/갤러리 권한 요청 팝업이 표시되는지 확인
  - 권한 허용 후 이미지 선택 가능한지 확인
- [ ] 이미지 미리보기 표시
- [ ] "분석 시작" 터치 -> 로딩 인디케이터 표시
- [ ] 분석 완료 후 시험 결과 화면(`app/exam/[id].tsx`)으로 이동
- [ ] **DB 검증**: `exams` 테이블에 레코드 생성 확인 (status: `processing` -> `ocr_done`)
- [ ] **DB 검증**: `questions` 테이블에 해당 exam_id로 문항 레코드 생성 확인
- [ ] **Storage 검증**: `exam-images` 버킷에 이미지 파일 업로드 확인

### 시나리오 3: AI 분석 결과 확인

**경로**: `app/exam/[id].tsx`

- [ ] 시험 결과 화면에서 Blueprint 차트(영역별 성취도) 표시
- [ ] 오답 문항 목록 표시
- [ ] 각 오답에 진단 카드 표시 (오류유형 배지: 개념 부족 / 계산 실수 / 시간 부족)
- [ ] 진단 카드에 한줄 설명 텍스트 표시
- [ ] 진단 카드 터치 -> 상세 모달 열림
  - stepByStep 풀이 과정 표시 (LaTeX 수식 렌더링 확인)
  - correction(교정 설명) 표시
- [ ] "미니테스트 생성" 버튼이 활성 상태로 표시
- [ ] **DB 검증**: `error_diagnoses` 테이블에 진단 레코드 확인
- [ ] **DB 검증**: `blueprints` 테이블에 블루프린트 레코드 확인

### 시나리오 4: 미니테스트 풀이

**경로**: `app/solve/[testId].tsx`

- [ ] 시험 결과 화면에서 "미니테스트 생성" 터치 -> 풀이 화면 이동
- [ ] 타이머 표시 및 카운트다운 동작 확인
- [ ] 첫 번째 문제 표시 (LaTeX 수식 렌더링 확인)
- [ ] 객관식 문제: 보기 선택 시 UI 하이라이트
- [ ] 주관식 문제: 텍스트 입력 가능
- [ ] "다음" 버튼으로 다음 문제 이동
- [ ] "이전" 버튼으로 이전 문제 복귀
- [ ] 마지막 문제에서 "제출" 버튼 표시
- [ ] "제출" 터치 -> 확인 모달 ("정말 제출하시겠습니까?")
- [ ] 확인 -> 결과 화면 표시
  - 총 점수 / 문제 수
  - 문제별 O/X 표시
  - 오답 문제에 대한 간략 해설
- [ ] **DB 검증**: `mini_tests` 테이블에 레코드 생성 확인
- [ ] **DB 검증**: `mini_test_answers` 테이블에 답안 레코드 확인
- [ ] **DB 검증**: `credits` 테이블에 크레딧 차감 내역 확인

### 시나리오 5: 시험 목록

**경로**: `app/(tabs)/index.tsx`

- [ ] 시험 탭(홈)에서 업로드한 시험 목록이 카드 형태로 표시
- [ ] 각 카드에 과목, 날짜, 상태 배지 표시
- [ ] 상태 필터 탭 동작 확인: 전체 / 분석중 / 완료 / 실패
- [ ] 카드 터치 -> 시험 상세 화면(`app/exam/[id].tsx`) 이동
- [ ] 화면을 아래로 당겨서 새로고침 (pull-to-refresh) 동작 확인
- [ ] 시험이 없을 때 빈 상태(empty state) 안내 표시

### 시나리오 6: 소셜

**경로**: `app/(tabs)/social.tsx`

- [ ] 하단 탭에서 소셜 탭 이동
- [ ] 검색 아이콘 터치 -> 검색 입력 모드 활성
- [ ] 닉네임 입력 후 검색 -> 검색 결과 목록 표시
- [ ] 검색 결과에서 유저 프로필 터치 -> 유저 정보 표시
- [ ] "팔로우" 버튼 터치 -> 팔로우 요청 전송
  - 버튼이 "요청됨" 상태로 변경되는지 확인
- [ ] 상대방이 수락한 경우 "팔로잉" 상태로 변경
- [ ] 피드에 팔로잉 유저가 공유한 아이템 표시
  - 변형문항 세트, 오답 노트, 미니테스트 결과, 블루프린트만 공유 가능
  - 원본 시험지는 공유 불가 (Rule 5 확인)
- [ ] **DB 검증**: `follows` 테이블에 팔로우 관계 레코드 확인
- [ ] **DB 검증**: `shared_items` 테이블에 공유 아이템 확인 (item_type이 'exam'이 아닌지 확인)

### 시나리오 7: 마이페이지

**경로**: `app/(tabs)/my.tsx`

- [ ] 하단 탭에서 마이페이지 이동
- [ ] 프로필 정보 표시: 닉네임, 이메일, 학년
- [ ] 크레딧 잔여량 숫자 + 프로그레스 바 표시
- [ ] 구독 상태 표시 (무료/프리미엄)
- [ ] "도움말" 메뉴 터치 -> 도움말 화면(`app/help.tsx`) 이동
- [ ] "알림" 메뉴 터치 -> 알림 화면(`app/notifications.tsx`) 이동
- [ ] "로그아웃" 터치 -> 확인 후 로그인 화면으로 이동
- [ ] 로그아웃 후 뒤로가기로 메인 화면 접근 불가 확인

### 시나리오 8: 학부모 (역할: parent)

**경로**: `app/(auth)/signup.tsx` -> `app/parent/dashboard.tsx`

> 이 시나리오는 별도의 학부모 계정이 필요합니다. 시나리오 1에서 역할을 "학부모"로 선택하여 가입하세요.

- [ ] 학부모 계정으로 로그인
- [ ] 마이페이지에 "자녀 학습 현황" 메뉴가 표시되는지 확인
- [ ] "자녀 학습 현황" 터치 -> 학부모 대시보드(`app/parent/dashboard.tsx`) 이동
- [ ] 자녀 미연결 상태: 링크 코드 입력 UI 표시
- [ ] 학생 계정에서 생성한 링크 코드 입력 -> 연결 요청
- [ ] 자녀 연결 성공 후 학습 통계 표시:
  - 전체 성적 추이 그래프
  - 약점 영역 히트맵
  - 오류유형별 분포
  - 미니테스트 점수 추이
- [ ] 원본 시험 이미지는 표시되지 않는지 확인 (Rule 6: 학부모 프라이버시)
- [ ] 개별 답안 내용은 표시되지 않는지 확인 (Rule 6)
- [ ] 소셜 활동 정보는 표시되지 않는지 확인 (Rule 6)
- [ ] **DB 검증**: `parent_links` 테이블에 연결 레코드 확인

### 시나리오 9: 알림

**경로**: `app/notifications.tsx`

- [ ] 알림 화면 이동
- [ ] 알림 목록 표시 (최신순 정렬)
- [ ] 읽지 않은 알림: 하이라이트(배경색 또는 도트) 표시
- [ ] 알림 터치 -> 읽음 처리 (하이라이트 제거)
- [ ] 알림 터치 -> 관련 화면으로 이동 (예: 분석 완료 알림 -> 시험 상세)
- [ ] "모두 읽음" 버튼 터치 -> 모든 알림 읽음 처리
- [ ] 알림이 없을 때 빈 상태 안내 표시
- [ ] **DB 검증**: `notifications` 테이블에서 `is_read` 필드 업데이트 확인

---

## 3. Edge Function 테스트

Edge Function은 서버 전용 키(OpenAI, Anthropic 등)를 사용하므로 별도로 테스트합니다.

### 3.1 로컬 실행

```bash
# Supabase 로컬 개발 환경 시작
npx supabase start

# Edge Functions 로컬 서빙
npx supabase functions serve
```

### 3.2 JWT 토큰 얻기

로컬 Supabase가 실행 중일 때, `npx supabase start` 출력에서 `anon key`를 복사합니다.
또는 Supabase Dashboard > Settings > API에서 복사합니다.

### 3.3 개별 Edge Function 호출

#### run-ocr
```bash
curl -X POST http://localhost:54321/functions/v1/run-ocr \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"examId": "exam-uuid-here"}'
```
- 성공 시: 200 + OCR 결과 JSON
- exam 미존재: 404
- 인증 실패: 401

#### analyze-exam
```bash
curl -X POST http://localhost:54321/functions/v1/analyze-exam \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"examId": "exam-uuid-here"}'
```
- 성공 시: 200 + 분석 결과 (진단, 블루프린트)
- 크레딧 부족: 402
- AI 서비스 오류: 503

#### generate-variants
```bash
curl -X POST http://localhost:54321/functions/v1/generate-variants \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"diagnosisId": "diagnosis-uuid-here"}'
```
- 성공 시: 200 + 변형문항 배열
- 크레딧 부족: 402
- AI 서비스 오류: 503

### 3.4 Edge Function 로그 확인

```bash
# 로컬 함수 로그 실시간 확인 (serve 중일 때 터미널에 출력)
# 배포된 함수 로그 확인
npx supabase functions logs run-ocr
npx supabase functions logs analyze-exam
npx supabase functions logs generate-variants
```

---

## 4. 자동 테스트 실행

### 4.1 타입 체크

```bash
npx tsc --noEmit
```
- 오류 0건이면 통과
- 오류 발생 시 파일명과 라인 번호 확인 후 수정

### 4.2 단위 + 통합 테스트

```bash
# 전체 테스트 실행 (단일 실행)
npm test

# 감시 모드 (파일 변경 시 자동 재실행)
npm run test:watch
```

테스트 파일 위치: `src/**/*.{test,spec}.{ts,tsx}`
설정 파일: `vitest.config.ts`

### 4.3 테스트 결과 읽기

```
 ✓ src/domain/rules/creditCalculation.test.ts (5 tests)
 ✓ src/usecases/exam/AnalyzeExamUseCase.test.ts (3 tests)
 ✗ src/usecases/social/ShareItemUseCase.test.ts (1 failed)
```
- 실패한 테스트가 있으면 에러 메시지와 스택 트레이스를 확인하세요.

---

## 5. 트러블슈팅

### "supabase client not initialized" 또는 "Invalid URL"
- **원인**: `.env.local` 파일이 없거나 `EXPO_PUBLIC_SUPABASE_URL` 값이 비어 있음
- **해결**: `.env.local` 파일 존재 여부 확인, URL과 키 값이 올바른지 확인
- **확인**: 개발 서버 재시작 (`npm start`)

### "RLS policy violation" (row-level security)
- **원인**: Supabase RLS 정책이 현재 사용자의 접근을 차단
- **해결**: Supabase Dashboard > Table Editor > 해당 테이블 > RLS Policies에서 정책 확인
- **확인**: `auth.uid()`가 올바른 사용자 ID를 반환하는지 확인

### Edge Function 403 Forbidden
- **원인**: Authorization 헤더의 JWT 토큰이 유효하지 않거나 만료됨
- **해결**: 유효한 anon key 또는 사용자 access_token 사용
- **확인**: `npx supabase start` 출력에서 최신 anon key 확인

### 이미지 업로드 실패
- **원인**: `exam-images` 스토리지 버킷이 존재하지 않음
- **해결**: Supabase Dashboard > Storage에서 `exam-images` 버킷 생성 (Section 1.3.3 참조)
- **확인**: 버킷 이름이 정확히 `exam-images`인지 확인 (오타 주의)

### "Module not found" 또는 의존성 오류
- **원인**: `node_modules`가 설치되지 않았거나 손상됨
- **해결**:
  ```bash
  rm -rf node_modules
  npm install
  ```

### Expo Go에서 앱이 로드되지 않음
- **원인**: Expo SDK 버전 불일치 또는 네트워크 문제
- **해결**:
  1. 모바일 기기와 개발 PC가 같은 WiFi 네트워크인지 확인
  2. Expo Go 앱이 최신 버전인지 확인 (SDK 55 지원 필요)
  3. 터미널에서 `npm start -- --tunnel` 옵션으로 터널 모드 시도

### LaTeX 수식이 렌더링되지 않음
- **원인**: `react-native-math-view` 패키지 문제
- **해결**: 에뮬레이터/실기기에서만 정상 동작 (Expo Go 제한 가능)
- **확인**: 수식 데이터가 유효한 LaTeX 문자열인지 DB에서 확인

---

## 6. Supabase Dashboard 데이터 검증

각 시나리오를 완료한 후, Supabase Dashboard > Table Editor에서 아래 테이블의 데이터를 확인합니다.

| 시나리오 | 확인할 테이블 | 확인 포인트 |
|---------|-------------|-----------|
| 1. 회원가입 | `auth.users`, `users` | 유저 레코드 생성, role 필드 |
| 2. 시험 업로드 | `exams`, `questions` | exam status 변화, 문항 수 |
| 3. AI 분석 | `error_diagnoses`, `blueprints` | 진단 레코드, 블루프린트 생성 |
| 4. 미니테스트 | `mini_tests`, `mini_test_answers`, `credits` | 테스트 레코드, 답안, 크레딧 차감 |
| 5. 시험 목록 | `exams` | 필터 조건과 일치하는 레코드 |
| 6. 소셜 | `follows`, `shared_items` | 팔로우 상태, 공유 item_type |
| 7. 마이페이지 | `users`, `credits` | 프로필, 크레딧 잔여량 |
| 8. 학부모 | `parent_links` | 링크 상태(pending/active) |
| 9. 알림 | `notifications` | is_read 필드 변경 |

### 데이터 무결성 체크

테스트 완료 후 SQL Editor에서 아래 쿼리를 실행하여 데이터 정합성을 확인합니다.

```sql
-- 시험에 연결된 문항 수 확인
SELECT e.id, e.subject, COUNT(q.id) as question_count
FROM exams e
LEFT JOIN questions q ON q.exam_id = e.id
GROUP BY e.id, e.subject;

-- 오답 진단이 오답 문항에만 연결되었는지 확인
SELECT ed.id, q.is_correct
FROM error_diagnoses ed
JOIN questions q ON q.id = ed.question_id
WHERE q.is_correct = true;  -- 이 결과가 0건이어야 정상

-- 공유 아이템에 원본 시험이 없는지 확인 (Rule 5)
SELECT * FROM shared_items WHERE item_type = 'exam';  -- 0건이어야 정상

-- 크레딧 잔액이 음수가 아닌지 확인
SELECT user_id, SUM(amount) as balance
FROM credits
GROUP BY user_id
HAVING SUM(amount) < 0;  -- 0건이어야 정상
```

---

## 7. 테스트 완료 체크리스트

모든 시나리오를 완료한 후 최종 확인합니다.

| 항목 | 상태 |
|------|------|
| 회원가입 + 온보딩 정상 동작 | [ ] |
| 시험 업로드 + OCR 정상 동작 | [ ] |
| AI 분석 결과 표시 정상 | [ ] |
| 미니테스트 풀이 + 채점 정상 | [ ] |
| 시험 목록 필터 + 네비게이션 정상 | [ ] |
| 소셜 팔로우 + 피드 정상 | [ ] |
| 마이페이지 정보 표시 + 로그아웃 정상 | [ ] |
| 학부모 대시보드 + 프라이버시 규칙 정상 | [ ] |
| 알림 목록 + 읽음 처리 정상 | [ ] |
| Edge Function 3종 정상 응답 | [ ] |
| `npx tsc --noEmit` 오류 0건 | [ ] |
| `npm test` 전체 통과 | [ ] |
| DB 무결성 쿼리 전체 통과 | [ ] |
