# Screen Specifications — Node Hierarchy Reference

All screens are in the `ui` .pen file. Use `batch_get(filePath: "ui", nodeIds: ["ID"])` to inspect.

## 1. Landing Page — `3aYA3` (1440xAuto)

### Child Frames
| ID | Name | Layout | Height |
|----|------|--------|--------|
| `cesE2` | Hero Section | vertical | 640 |
| `olS6s` | 3-Step Section | vertical | auto |
| `zIclc` | Features Section | vertical | auto |
| `59FDm` | Pricing Section | vertical | auto |

### Hero Section (`cesE2`)
- Background: indigo gradient (#4F46E5 → #312E81)
- Headline: "시험지 한 장이 내신 대비 플랜이 됩니다" (52px, bold, white)
- Subtitle: "AI가 30초 만에..." (18px, white/80%)
- CTA Button: coral orange (#F97316), "시험지 업로드하기 →"
- Hero mockup image placeholder on right

### 3-Step Section (`olS6s`)
- 3 cards in horizontal row
- Step 1: Camera icon + "시험지를 찍으세요"
- Step 2: Sparkles icon + "AI가 분석합니다"
- Step 3: Check icon + "모바일에서 바로 풀기"

### Features Section (`zIclc`)
- 4 feature cards in 2x2 grid
- Each: icon + title + description + thumbnail preview

### Pricing Section (`59FDm`)
- 4 pricing cards: Free, Standard (9,900원), Premium (19,900원), 시즌패스 (6,900원)
- Standard card highlighted with indigo border

## 2. Exam Upload — `OC4JE` (390x844)

### Structure
- Nav bar (56px): back arrow + "시험지 업로드"
- Upload zone: dashed border rectangle, camera + document icon
- Two buttons: "카메라 촬영" + "파일 선택"
- Tip card: lightbulb icon + photography tip
- (Processing state): scan animation overlay + progress text

## 3. Question Verification — `GXbHx` (390x844)

### Structure
- Top bar: "문항 확인" + "20문항" badge + progress
- Swipeable question card area
- Each card: question number pill + point badge + content + options + confidence badge
- Bottom: dot indicators + prev/next buttons

## 4. Exam Blueprint — `aCW8X` (390x1200)

### Structure
- Header card: indigo gradient, subject/grade/exam info
- Unit distribution: horizontal stacked bar chart
- Type distribution: donut chart (객관식/주관식/서술형)
- Difficulty distribution: 3 horizontal bars (쉬움/보통/어려움)
- AI insight card: sparkle icon + 2-3 insight bullets
- CTA: "오답 분석 시작하기 →" (coral)
- Share button top right

## 5. Error Diagnosis — `7Roux` (390x1100)

### Structure
- Summary bar: "7문항 오답 분석 완료" + 3 type pills
- Stacked diagnosis cards, each with:
  - Question number + points
  - Error type badge (color-coded left border)
  - Original question + answers
  - AI diagnosis text
  - Confidence badge
  - "교정 문제 풀기" button + thumbs up/down

## 6. MC Solving — `xGmv0` (390x844)

### Structure
- Timer bar (orange progress) + question counter + pause button
- Question card (upper 60%): question text with KaTeX math
- Answer area (lower 40%): 5 vertical option cards
  - Unselected: white bg, circle right
  - Selected: indigo bg, white text, checkmark
- Bottom: "정답 확인 →" button (coral)

## 7. Math Keypad — `bI67Q` (390x844)

### Structure
- Timer bar + question counter (same as MC)
- Question area (upper 50%)
- Answer input field with KaTeX preview
- Math keypad (bottom 40%):
  - Special row (scrollable): 분수, 루트, 지수, 절댓값, log, sin, cos, tan
  - Main 5x5 grid:
    - Row 1: 7, 8, 9, ÷, ⌫
    - Row 2: 4, 5, 6, ×, √
    - Row 3: 1, 2, 3, −, x²
    - Row 4: 0, ., π, +, ⁿ√
    - Row 5: ½, x, (, ), =
- "정답 확인 →" button below keypad

### Key Styling
- Numbers: white bg (#FFFFFF), dark text
- Operators: light indigo bg (#EEF2FF)
- Math special: light coral bg (#FFF7ED)
- Backspace: rose bg (#FFF1F2)
- Min size: 44x44px per key

## 8. Mini Test Results — `3do98` (390x1000)

### Structure
- Score circle (large, centered): ring chart with percentage
  - ≥80%: green ring + "대단해요!"
  - 50-79%: amber ring + "잘하고 있어요!"
  - <50%: rose ring + "다음엔 더 잘할 수 있어요!"
- Comparison bar: "+15점 향상 📈" (if returning user)
- Time stats: total time + average per question
- Question-by-question horizontal scroll cards (green/red border)
- Action buttons: 공유하기, 오답노트에 추가, 틀린 문제 다시 풀기

## 9. Parent Dashboard — `aNW43` (1200x900)

### Child Frames
| ID | Name | Purpose |
|----|------|---------|
| `Gr9km` | Top Nav | Logo + tabs + profile |
| `eR7em` | Child Selector | Horizontal avatar pills |
| `dHbvx` | Dashboard Grid | Two-column layout |
| `poEeJ` | pdCol1 | Weekly stats + error bars |
| `Jpd5C` | pdCol2 (360px) | D-day + activity feed |

### Dashboard Cards (in pdCol1)
- Weekly summary: 풀이 문항, 학습 시간, 접속일 (with delta arrows)
- Weakness heatmap: unit accuracy color grid
- Score trend: line chart with date axis
- Error pattern: pie chart (3 types)

### Dashboard Cards (in pdCol2)
- D-day card: "기말고사까지 D-14" + progress bar
- Activity feed: timeline list of recent actions

## 10. Social Feed — `ZN9DE` (390x1100)

### Structure
- Top tabs: 피드 (active) | 내 공유 | 팔로잉 23
- Feed cards (3 types):
  - Variant set share: avatar + "변형문항 세트를 공유" + detail card + "바로 풀어보기"
  - Error note share: avatar + "오답노트를 공유" + error info + "풀어보기"
  - Test result share: avatar + "미니테스트 완료" + score circle + "같은 문제 도전하기"
- Each card: like count + comments
- FAB (bottom right): "+ 공유하기" coral circle

## 11. Follow Search — `dm9DB` (390x844)

### Structure
- Search bar: "닉네임으로 친구 검색"
- Tabs: 추천 친구 | 팔로잉 | 팔로워
- Recommended cards: avatar + nickname + grade + stats + follow button
- Pending requests: amber card with accept/reject buttons
- Bottom info: privacy notice + 200 limit notice

## 12. Profile Stats — `8nTHB` (390x1200)

### Structure
- Profile header: emoji avatar + nickname + grade badge
- Stats row: 팔로워 | 팔로잉 | 공유 문항
- Study statistics: total solved + calendar heatmap (GitHub-style)
- Achievement badges: horizontal scroll (completed/locked/in-progress)
- Error type trend: small line chart
- Unit proficiency: radar/pentagon chart
- Settings menu: list items

## 13a. Link - Code (child) — `vvoE0` (390x844)

### Structure
- Title: "학부모 연동"
- Illustration: parent-child connection
- Privacy notice card
- 6-digit code display: `codeBox` with `c1`-`c6` digit slots (44x56 each)
- Expiry timer: "유효시간: 23:59"
- Copy button + KakaoTalk send button (yellow)
- Bottom text: "연동은 언제든 해제 가능"

## 13b. Link - Enter (parent) — `Gyoc2` (390x844)

### Structure
- Title: "자녀 연동하기"
- Blurred dashboard preview illustration
- OTP-style input: `otpRow` with `o1`-`o6` slots (48x60 each)
- "연동하기" button (indigo, activates when 6 digits entered)
- Helper text

## 14. Notifications — `AUq3k` (390x1000)

### Structure
- Title: "알림" + "모두 읽음" button
- Grouped by date (오늘, 어제, ...)
- Notification types with color dots:
  - 🟠 Orange: Social (shares, follows)
  - 🟢 Green: Learning achievements
  - 🔵 Blue: Follow requests
  - 🟣 Purple: Parent activity
  - ⚪ Gray: System notices
- Unread: white bg + left indigo border
- Read: slightly grayed bg

## 15a. Onboarding 1 — `KLIE4` (390x844)

### Structure
- Welcome illustration (200x200)
- Title: "시험지 한 장으로 시작하는 AI 내신 대비"
- 3 feature cards: 시험지 촬영, AI 변형문항, 친구와 공유
- Pagination dots (3 dots in `dotsRow`)
- CTA: "시작하기!" (coral)

## 15b. Onboarding 2 — `nLYpt` (390x844)

### Structure
- Title: "어떤 사용자이신가요?"
- Two role selection cards side by side:
  - `studentCard` (`h9VTN`): 📚 + "학생" + description
  - `parentCard` (`wvGnV`): 👨‍👩‍👧 + "학부모" + description
- Selected state: indigo border highlight
- Next button
- Pagination dots (3 dots in `dots2Row`)
