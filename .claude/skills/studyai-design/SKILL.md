---
name: studyai-design
description: |
  Guide UI/UX design work using Pencil MCP tools for .pen files, following the established brand system for the StudyAI (시험의 신) exam preparation platform.
  Use this skill when:
  - Designing a new screen or modifying existing screens in the ui .pen file
  - Creating or editing UI components (cards, buttons, badges, inputs, charts)
  - Reviewing or validating design layouts with screenshots
  - Checking design consistency with the brand system
  - Working with Pencil MCP tools (batch_get, batch_design, get_screenshot, snapshot_layout)
  - Adding new frames to the canvas
  - Updating colors, typography, spacing, or other design tokens
  - Creating responsive layouts for mobile, tablet, or desktop
  - Designing micro-interactions or animation specifications
  - Reviewing Korean typography and accessibility in designs
  Do NOT use for: Writing frontend code (use studyai-presentation). Backend/DB/adapter work (use studyai-infrastructure). AI pipeline/use case logic (use studyai-usecases or studyai-infrastructure). Domain entities/rules (use studyai-domain).
---

# StudyAI UI/UX Design Guide

Reference: `시험의신_디자인_프롬프트_가이드.md` (15 screen design prompts + brand system)
Design file: `ui` (Pencil .pen format, always use `filePath: "ui"` with Pencil MCP tools)

## 1. Design File Structure

The `ui` file contains 17 frames across 15 screen categories:

| # | Screen | Frame ID | Size | Row |
|---|--------|----------|------|-----|
| 1 | Landing Page | `3aYA3` | 1440xAuto | Row 1 (y:3200) — *web marketing only, not in mobile app* |
| 2 | Exam Upload | `OC4JE` | 390x844 | Row 1 |
| 3 | Question Verification | `GXbHx` | 390x844 | Row 1 |
| 4 | Exam Blueprint | `aCW8X` | 390x1200 | Row 1 |
| 5 | Error Diagnosis | `7Roux` | 390x1100 | Row 1 |
| 6 | MC Solving | `xGmv0` | 390x844 | Row 1 |
| 7 | Math Keypad | `bI67Q` | 390x844 | Row 1 |
| 8 | Mini Test Results | `3do98` | 390x1000 | Row 1 |
| 9 | Parent Dashboard | `aNW43` | 1200x900 | Row 2 (y:5800) — *mobile app uses 390px single-column variant* |
| 10 | Social Feed | `ZN9DE` | 390x1100 | Row 2 |
| 11 | Follow Search | `dm9DB` | 390x844 | Row 2 |
| 12 | Profile Stats | `8nTHB` | 390x1200 | Row 2 |
| 13a | Link - Code (child) | `vvoE0` | 390x844 | Row 2 |
| 13b | Link - Enter (parent) | `Gyoc2` | 390x844 | Row 2 |
| 14 | Notifications | `AUq3k` | 390x1000 | Row 2 |
| 15a | Onboarding 1 | `KLIE4` | 390x844 | Row 2 |
| 15b | Onboarding 2 | `nLYpt` | 390x844 | Row 2 |

**Notable sub-frames:**
- Landing Page sections: `cesE2` (Hero), `olS6s` (3-Step), `zIclc` (Features), `59FDm` (Pricing)
- Parent Dashboard: `Gr9km` (Nav), `eR7em` (Child Selector), `dHbvx` (Grid) → `poEeJ` (Col1), `Jpd5C` (Col2)

## 2. Brand Design System

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#4F46E5` | Buttons, active states, selected items |
| Primary Dark | `#312E81` | Hero gradient end, dark accents |
| Secondary | `#F97316` | CTAs, action buttons, timer bar |
| Accent | `#10B981` | Correct answers, success, growth |
| Alert | `#F43F5E` | Errors, wrong answers, weak areas |
| Amber | `#F59E0B` | Warnings, calculation error type |
| Blue | `#3B82F6` | Time pressure type, info badges |
| Background | `#F8FAFC` | Page backgrounds |
| Card BG | `#FFFFFF` | Card surfaces |
| Border | `#E2E8F0` | Card borders (1px solid) |
| Text Heading | `#0F172A` | Headings, primary text |
| Text Body | `#475569` | Body text, descriptions |
| Text Muted | `#94A3B8` | Placeholders, secondary info |

### Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Hero Title | Inter | 52px | 700 | 1.2 |
| Section Title | Inter | 28-32px | 700 | 1.3 |
| Card Title | Inter | 18-20px | 600 | 1.4 |
| Body Text | Inter | 14-16px | 400 | 1.5 |
| Caption | Inter | 12-13px | 400-500 | 1.4 |
| Badge Text | Inter | 12-14px | 500-600 | 1.0 |
| Math (KaTeX) | - | 16px min mobile | - | - |

Use `fontFamily: "Inter"` in .pen file. Pretendard is applied at runtime for Korean glyphs.

### Spacing & Layout

- Grid: 8px base unit
- Card padding: 20-24px
- Section gap: 24-32px
- Component gap: 12-16px
- Mobile screen padding: 20px horizontal

### Shape Tokens

| Element | Border Radius | .pen property |
|---------|--------------|---------------|
| Cards | 12px | `cornerRadius: 12` |
| Buttons | 8-12px | `cornerRadius: 8` or `12` |
| Pills/Badges | 24px or 999 | `cornerRadius: 999` for circle |
| Inputs | 8px | `cornerRadius: 8` |
| Avatars | 999 (circle) | `cornerRadius: 999` |

### Shadow
```json
{ "type": "shadow", "shadowType": "outer", "color": "#00000018", "offset": { "x": 0, "y": 1 }, "blur": 3 }
```
Elevated elements: blur 16.

### Icons
Use Lucide icon family (`iconFontFamily: "lucide"`):
- `sparkles` (AI), `upload`, `camera`, `check-circle`, `x-circle`, `clock`, `users`, `bell`, `bar-chart-2`, `share-2`, `book-open`

## 3. Pencil MCP Workflow

### Reading Designs
```
batch_get(filePath: "ui", nodeIds: ["3aYA3"], readDepth: 3)
batch_get(filePath: "ui")  -- list all top-level frames
batch_get(filePath: "ui", patterns: [{ type: "text", name: "hero" }], searchDepth: 3)
```

### Taking Screenshots
After any modification, always verify:
```
get_screenshot(filePath: "ui", nodeId: "3aYA3")
```
Check: alignment, text overflow, color consistency, spacing, visual balance.

### Creating New Frames
Use `find_empty_space_on_canvas` first, then insert:
```javascript
newScreen=I(document, {
  type: "frame", name: "New Screen",
  clip: true, width: 390, height: 844,
  fill: "#F8FAFC", layout: "vertical"
})
```
Mobile: 390x844 (primary target for native app). Tablet/Desktop frames (1200 or 1440 wide) are for web reference only.

### Design Validation
After every `batch_design`:
1. `get_screenshot` on modified frame
2. `snapshot_layout(filePath: "ui", parentId: frameId, problemsOnly: true)` to detect overflow
3. Fix in follow-up `batch_design`
4. Final screenshot to confirm

## 4. Component Patterns

### Navigation Bar (56px)
```javascript
nav=I(parentFrame, {
  type: "frame", name: "nav", width: "fill_container",
  height: 56, fill: "#FFFFFF", gap: 12,
  padding: [0, 20], alignItems: "center"
})
```

### Card with Border
```javascript
card=I(parentFrame, {
  type: "frame", name: "card", width: "fill_container",
  fill: "#FFFFFF", cornerRadius: 12,
  stroke: { align: "inside", thickness: 1, fill: "#E2E8F0" },
  layout: "vertical", gap: 12, padding: 20
})
```

### Primary CTA Button (Coral)
```javascript
btn=I(parentFrame, {
  type: "frame", name: "ctaBtn", fill: "#F97316",
  cornerRadius: 12, padding: [16, 32],
  justifyContent: "center", alignItems: "center"
})
label=I(btn, {
  type: "text", content: "버튼 텍스트",
  fill: "#FFFFFF", fontFamily: "Inter",
  fontSize: 16, fontWeight: "600"
})
```

### Indigo Button
```javascript
btn=I(parentFrame, {
  type: "frame", name: "indigoBtn", fill: "#4F46E5",
  cornerRadius: 8, padding: [12, 24],
  justifyContent: "center", alignItems: "center"
})
```

### Badge/Pill
```javascript
badge=I(parentFrame, {
  type: "frame", fill: "#4F46E510", cornerRadius: 999,
  padding: [4, 12], alignItems: "center"
})
badgeText=I(badge, {
  type: "text", content: "Badge", fill: "#4F46E5",
  fontFamily: "Inter", fontSize: 12, fontWeight: "600"
})
```

### Input Field
```javascript
input=I(parentFrame, {
  type: "frame", name: "input", width: "fill_container",
  height: 48, fill: "#FFFFFF", cornerRadius: 8,
  stroke: { align: "inside", thickness: 1, fill: "#E2E8F0" },
  padding: [0, 16], alignItems: "center"
})
placeholder=I(input, {
  type: "text", content: "입력하세요",
  fill: "#94A3B8", fontFamily: "Inter", fontSize: 14
})
```

## 5. Error Type Visual Language

| Type | Korean | Color | Left Border | Icon |
|------|--------|-------|------------|------|
| Concept Gap | 개념 부족 | `#F43F5E` (Rose) | 4px | book-open |
| Calculation Error | 계산 실수 | `#F59E0B` (Amber) | 4px | pencil |
| Time Pressure | 시간 부족 | `#3B82F6` (Blue) | 4px | clock |

Always pair color with icon (never color alone for accessibility).

## 6. Micro-Interaction Specs

| Interaction | Animation | Duration |
|------------|-----------|----------|
| Button press | scale(0.98) spring | 200ms |
| Card tap | scale(0.98) + bounce | 200ms |
| Answer select | indigo fill sweep L→R | 150ms |
| Correct reveal | green pulse + confetti | 500ms |
| Wrong reveal | horizontal shake (3x) | 300ms |
| Score counter | number roll-up | 1500ms ease-out |
| Share action | card lift + fly to icon | 400ms |
| Skeleton load | shimmer L→R | continuous |
| Cards stagger-in | fade + slide up | 100ms delay each |
| Follow accept | avatars slide + connect | 500ms |

## 7. Korean Typography Best Practices

- Never break Korean words mid-syllable (word-break: keep-all)
- Use 1.5-1.6 line height for Korean body text
- Min 14px body text, min 16px math formulas on mobile
- Pretendard as primary font (includes Latin glyphs), Inter as fallback

## 8. Accessibility in Design

- 4.5:1 contrast ratio minimum for all text (WCAG AA)
- Touch targets: min 44x44px
- Error states: color AND icon (not color alone)
- Success states: color AND icon (not color alone)
- Avatar: emoji or geometric (no real photos for minors)

## Additional Resources

- Detailed screen node hierarchies: `references/screen-specs.md`
- Full design prompts: `시험의신_디자인_프롬프트_가이드.md`
- Business plan features: `시험의신_통합_사업기획서_v2.md`
